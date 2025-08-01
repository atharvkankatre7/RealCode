// server/test-db.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Room from './models/Room.js';

// Load environment variables
dotenv.config();

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection...');
    
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/realcode';
    console.log('📡 Connecting to:', mongoURI);
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Database connected successfully');
    
    // Test creating a room
    console.log('🧪 Testing room creation...');
    const testRoomId = `test-${Date.now()}`;
    const testRoom = new Room({
      roomId: testRoomId,
      createdBy: 'test-user',
      currentCode: {
        content: 'console.log("Hello World!");',
        language: 'javascript',
        lastSaved: new Date(),
        lastSavedBy: 'test-user'
      }
    });
    
    await testRoom.save();
    console.log('✅ Test room created successfully');
    
    // Test finding the room
    console.log('🔍 Testing room retrieval...');
    const foundRoom = await Room.findOne({ roomId: testRoomId });
    if (foundRoom) {
      console.log('✅ Test room found successfully');
      console.log('📄 Room data:', {
        roomId: foundRoom.roomId,
        createdBy: foundRoom.createdBy,
        codeLength: foundRoom.currentCode.content.length,
        language: foundRoom.currentCode.language
      });
    } else {
      console.log('❌ Test room not found');
    }
    
    // Test updating the room
    console.log('✏️  Testing room update...');
    const updateResult = await Room.findOneAndUpdate(
      { roomId: testRoomId },
      {
        "currentCode.content": 'console.log("Updated code!");',
        "currentCode.lastSaved": new Date(),
        "currentCode.lastSavedBy": 'test-user-updated'
      },
      { new: true }
    );
    
    if (updateResult) {
      console.log('✅ Test room updated successfully');
      console.log('📄 Updated code:', updateResult.currentCode.content);
    } else {
      console.log('❌ Test room update failed');
    }
    
    // Test the saveCode method
    console.log('💾 Testing saveCode method...');
    const roomToTest = await Room.findOne({ roomId: testRoomId });
    if (roomToTest) {
      await roomToTest.saveCode('console.log("Method test!");', 'javascript', 'test-user-method');
      console.log('✅ saveCode method works successfully');
    }
    
    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await Room.deleteOne({ roomId: testRoomId });
    console.log('✅ Test data cleaned up');
    
    console.log('🎉 All database tests passed!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  }
}

// Run the test
testDatabase(); 