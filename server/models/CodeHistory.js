import mongoose from 'mongoose';

const codeHistorySchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true,
    index: true // For faster queries
  },
  title: { 
    type: String, 
    required: true,
    default: 'Untitled Code'
  },
  code: { 
    type: String, 
    required: true 
  },
  language: { 
    type: String, 
    required: true 
  },
  description: String,
  tags: [String],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Compound index for efficient queries and maintaining order
codeHistorySchema.index({ userId: 1, createdAt: -1 });

// Pre-save middleware to update the updatedAt field
codeHistorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to maintain 20-file limit per user
codeHistorySchema.statics.maintainFileLimit = async function(userId) {
  const count = await this.countDocuments({ userId });
  
  if (count > 20) {
    // Find the oldest files beyond the limit
    const oldestFiles = await this.find({ userId })
      .sort({ createdAt: 1 })
      .limit(count - 20);
    
    // Delete the oldest files
    const fileIds = oldestFiles.map(file => file._id);
    await this.deleteMany({ _id: { $in: fileIds } });
    
    console.log(`🗑️ Deleted ${fileIds.length} old files for user ${userId} to maintain 20-file limit`);
  }
};

const CodeHistory = mongoose.model('CodeHistory', codeHistorySchema);

export default CodeHistory;
