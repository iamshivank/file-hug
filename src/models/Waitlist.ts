import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWaitlist extends Document {
  name: string;
  email: string;
  createdAt: Date;
}

const WaitlistSchema = new Schema<IWaitlist>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

WaitlistSchema.index({ email: 1 }, { unique: true });

const Waitlist: Model<IWaitlist> =
  mongoose.models.Waitlist || mongoose.model<IWaitlist>('Waitlist', WaitlistSchema);

export default Waitlist;
