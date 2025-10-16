const client = new Appwrite.Client();

client
    .setEndpoint('https://sfo.cloud.appwrite.io/v1') // Your Appwrite Endpoint
    .setProject('68f04b740016e7f878b3'); // Your project ID

window.appwriteStorage = new Appwrite.Storage(client);