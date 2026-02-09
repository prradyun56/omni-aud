const mongoose = require('mongoose');

async function testConnection() {
    const uri = process.env.MONGODB_URI ||
        "mongodb+srv://kasukabedefenseclubdevsoc_db_user:Db5rZDjjNX9CTLGI@devsoc.pbw5gkm.mongodb.net/?appName=devsoc";

    console.log('Testing MongoDB connection with Mongoose...');
    console.log('URI:', uri.replace(/:[^:@]+@/, ':****@')); // Hide password

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });

        console.log('✅ Successfully connected to MongoDB!');
        console.log('📊 Connection state:', mongoose.connection.readyState); // 1 = connected
        console.log('🏢 Database name:', mongoose.connection.name);

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('📁 Collections:', collections.length > 0 ? collections.map(c => c.name).join(', ') : 'No collections yet');

        await mongoose.disconnect();
        console.log('👋 Disconnected successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Connection failed!');
        console.error('Error:', error.message);
        if (error.code) console.error('Error code:', error.code);
        process.exit(1);
    }
}

testConnection();
