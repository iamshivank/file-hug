import mongoose, { Document, Model } from 'mongoose';

export interface IMemory extends Document {
  content: string;
  type: 'url' | 'note';
  title: string;
  tags: string[];
  linkedMemoryIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const memorySchema = new mongoose.Schema<IMemory>(
  {
    content: { type: String, required: true, maxlength: 5000 },
    type: { type: String, enum: ['url', 'note'], required: true },
    title: { type: String, required: true, maxlength: 200 },
    tags: [{ type: String, maxlength: 50 }],
    linkedMemoryIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

memorySchema.index({ createdAt: -1 });
memorySchema.index({ type: 1 });

const Memory: Model<IMemory> =
  mongoose.models.Memory || mongoose.model<IMemory>('Memory', memorySchema);

export default Memory;
