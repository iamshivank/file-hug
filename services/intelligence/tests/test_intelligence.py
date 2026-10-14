import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from ai import Match, PageContext, Ranking, rerank
from auth import SessionUser
from extraction import ExtractedPage, fetch_page
from routers.link_index import index_memory
from routers.search import search
from schemas import IndexRequest


class IntelligenceTests(unittest.IsolatedAsyncioTestCase):
    async def test_unreadable_page_is_failed_even_with_saved_title(self):
        with (patch('routers.link_index.db.fetch_memory_for_index', AsyncMock(return_value={
            'type': 'url', 'content': 'https://example.com/123', 'title': 'Website', 'tags': ['web']
        })), patch('routers.link_index.fetch_page', AsyncMock(return_value=ExtractedPage(
            url='https://example.com/123', error='blocked'))), patch(
            'routers.link_index.db.upsert_memory_index', AsyncMock()) as save):
            result = await index_memory(IndexRequest(memory_id='m', force=True), SessionUser(id='owner'))
            self.assertEqual(result.status, 'failed')
            self.assertIsNone(save.call_args.kwargs['embedding'])

    async def test_context_and_tags_are_persisted_and_embedded(self):
        with (patch('routers.link_index.db.fetch_memory_for_index', AsyncMock(return_value={
            'type': 'url', 'content': 'https://example.com/123', 'title': 'Custom', 'tags': ['web']
        })), patch('routers.link_index.fetch_page', AsyncMock(return_value=ExtractedPage(
            url='https://example.com/123', text='Spaced repetition schedules retrieval over time.'))), patch(
            'routers.link_index.get_settings', return_value=SimpleNamespace(OPENAI_API_KEY='test')),
            patch('routers.link_index.understand_page', AsyncMock(return_value=PageContext(
                summary='A method for retaining knowledge.', tags=['Learning', 'memory'],
                search_intents=['How can I stop forgetting what I study?']))) as understand,
            patch('routers.link_index.get_embedder') as embedder,
            patch('routers.link_index.db.upsert_memory_index', AsyncMock()) as save):
            embedder.return_value.embed = AsyncMock(return_value=[1., 0.])
            result = await index_memory(IndexRequest(memory_id='m', force=True), SessionUser(id='owner'))
            self.assertEqual(result.status, 'ready')
            self.assertEqual(save.call_args.kwargs['user_id'], 'owner')
            self.assertEqual(save.call_args.kwargs['keywords'], ['learning', 'memory'])
            self.assertIn('stop forgetting', save.call_args.kwargs['search_text'])
            self.assertIn('Spaced repetition', understand.call_args.args[0])

    async def test_reranking_rejects_invented_duplicate_and_unrelated_ids(self):
        with (patch('ai.structured', AsyncMock(return_value=Ranking(matches=[
            Match(id='a', relevance=95), Match(id='other-user', relevance=100),
            Match(id='a', relevance=80), Match(id='b', relevance=10)])))):
            matches = await rerank('remember my studies', [{'id': 'a'}, {'id': 'b'}])
            self.assertEqual([m.id for m in matches], ['a'])

    async def test_semantic_query_returns_link_without_word_overlap(self):
        from datetime import datetime, timezone
        with (patch('routers.search.get_settings', return_value=SimpleNamespace(OPENAI_API_KEY='test')),
            patch('routers.search.db.search_fts', AsyncMock(return_value=[])),
            patch('routers.search.db.search_index_fts', AsyncMock(return_value=[])),
            patch('routers.search.db.user_has_index_embeddings', AsyncMock(return_value=True)),
            patch('routers.search.get_embedder') as embedder,
            patch('routers.search.db.search_index_semantic', AsyncMock(return_value=[{'id':'a','distance':0.3}])) as retrieve,
            patch('routers.search.db.fetch_memories_by_ids', AsyncMock(return_value={'a': {
                'id':'a', 'title':'Spaced repetition', 'content':'https://example.com/123',
                'type':'url', 'tags':[], 'created_at':datetime.now(timezone.utc)}})),
            patch('routers.search.db.fetch_index_snippets', AsyncMock(return_value={'a':'Retain knowledge'})),
            patch('routers.search.rerank', AsyncMock(return_value=[Match(id='a',relevance=95)]))):
            embedder.return_value.embed = AsyncMock(return_value=[1., 0.])
            result = await search('stop forgetting what I study', 20, SessionUser(id='owner'))
            self.assertEqual(result.mode, 'ai')
            self.assertEqual([r.id for r in result.results], ['a'])
            self.assertEqual(retrieve.call_args.args[0], 'owner')

    async def test_private_url_is_rejected(self):
        page = await fetch_page('http://127.0.0.1/secrets')
        self.assertIn('Unsafe', page.error)

    async def test_page_fetch_pins_ip_and_preserves_tls_hostname(self):
        import httpx
        def respond(request):
            self.assertEqual(request.url.host, '93.184.216.34')
            self.assertEqual(request.headers['host'], 'example.com')
            self.assertEqual(request.extensions['sni_hostname'], 'example.com')
            return httpx.Response(200, headers={'content-type': 'text/html'},
                                  text='<title>Learning</title><main>Retrieval practice</main>')
        with (patch('extraction.is_safe_url', return_value=(True, None, '93.184.216.34')),
              patch('extraction.httpx.AsyncHTTPTransport', return_value=httpx.MockTransport(respond))):
            page = await fetch_page('https://example.com/123')
            self.assertEqual(page.title, 'Learning')
            self.assertEqual(page.text, 'Retrieval practice')
            self.assertIsNone(page.error)

    async def test_long_embeddings_are_chunked_and_use_configured_dimensions(self):
        from embeddings import OpenAIEmbedder
        embedder = OpenAIEmbedder('test', dim=2)
        create = AsyncMock(return_value=SimpleNamespace(data=[
            SimpleNamespace(index=1, embedding=[0., 1.]),
            SimpleNamespace(index=0, embedding=[1., 0.])]))
        embedder._client.embeddings.create = create
        with patch('tiktoken.get_encoding') as encoding:
            encoding.return_value.encode.return_value = [42] * 7000
            vector = await embedder.embed('long multilingual document')
        self.assertEqual(create.call_args.kwargs['dimensions'], 2)
        self.assertEqual([len(c) for c in create.call_args.kwargs['input']], [6000, 1000])
        self.assertAlmostEqual(sum(v*v for v in vector), 1.)
        self.assertGreater(vector[0], vector[1])

    async def test_backfill_continues_after_a_failed_batch(self):
        from scripts.backfill_link_index import backfill
        with (patch('scripts.backfill_link_index.get_embedder') as embedder,
              patch('scripts.backfill_link_index.db.fetch_links_needing_index', AsyncMock(
                  side_effect=[[{'id': 'a'}], [{'id': 'b'}], []])) as fetch,
              patch('scripts.backfill_link_index._index_one', AsyncMock(side_effect=['failed', 'ready']))):
            embedder.return_value.dim = 384
            ready, failed = await backfill('owner', 1, 1, True)
            self.assertEqual((ready, failed), (1, 1))
            self.assertEqual(fetch.call_count, 3)


if __name__ == '__main__':
    unittest.main()
