// data processing for insert operation
const originalJson = {
    fileURL: originalURL,
    base64: base64Image
}

const downsizedJson = {
    fileURL: downsizedURL,
    base64: downsizedImageBase64
}

const thumbnailJson = {
    fileURL: thumbnailURL,
    base64: thumbnailBase64
}


const ImageInfoJson = {
    filename: filename,
    size: sizeInKilobytes,
    dimensions: (await simpleJson).dimensions,
    textCaptions: (await simpleJson).textCaptions,
    entitiesLists: (await simpleJson).entitiesLists,
    originalURL: originalURL,
    downsizedURL: downsizedURL,
    thumbnailURL: thumbnailURL
}

// insert data into cosmosDB
const client = await MongoClient.connect(mongourl, { tls: true });
console.log('Connected successfully to server');

const db = client.db('myphotolibrary-database');

const imageStorageCollection = db.collection('imageStorage');
await imageStorageCollection.insertOne(originalJson);
await imageStorageCollection.insertOne(downsizedJson);
await imageStorageCollection.insertOne(thumbnailJson);

const imageInfoCollection = db.collection('imageInfo');
const num = await imageInfoCollection.countDocuments();
ImageInfoJson["id"] = num + 1;
await imageInfoCollection.insertOne(ImageInfoJson);


client.close();