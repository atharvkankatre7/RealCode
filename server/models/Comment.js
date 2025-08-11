import mongoose from 'mongoose';

const rangeSchema = new mongoose.Schema({
  startLineNumber: { type: Number, required: true },
  startColumn: { type: Number, required: true },
  endLineNumber: { type: Number, required: true },
  endColumn: { type: Number, required: true }
}, { _id: false });

const commentSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  authorEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  authorName: { type: String },
  text: { type: String, required: true },
  range: { type: rangeSchema, required: true },
  resolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

commentSchema.index({ roomId: 1, createdAt: -1 });

commentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;


