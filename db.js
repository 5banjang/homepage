// Shared Database Logic (Firebase)

// Initialize Firebase
if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded.');
} else if (typeof firebaseConfig === 'undefined') {
    console.error('firebaseConfig not found. Make sure firebase-config.js is loaded.');
} else {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
}

const db = firebase.firestore();
const storage = firebase.storage();

// --- Database Functions ---

async function saveToDB(collectionName, data) {
    // Handle File Uploads first if blobs/files are present
    // We expect 'afterBlob', 'beforeBlob', 'imageBlob' in data
    // These can be Blob or File objects.
    // We need to convert them to Storage URLs

    const uploads = [];

    if (data.afterBlob) {
        uploads.push(uploadFile(data.afterBlob, collectionName).then(url => data.afterUrl = url));
        delete data.afterBlob;
    }
    if (data.beforeBlob) {
        uploads.push(uploadFile(data.beforeBlob, collectionName).then(url => data.beforeUrl = url));
        delete data.beforeBlob;
    }
    if (data.imageBlob) {
        uploads.push(uploadFile(data.imageBlob, collectionName).then(url => data.imageUrl = url));
        delete data.imageBlob;
    }

    await Promise.all(uploads);

    // Add timestamp if not present (or overwrite with server timestamp)
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    return db.collection(collectionName).add(data);
}

async function getAllFromDB(collectionName) {
    const snapshot = await db.collection(collectionName).get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Timestamp to Date object for compatibility
        createdAt: doc.data().createdAt ? doc.data().createdAt.toDate().toISOString() : new Date().toISOString()
    }));
}

async function deleteFromDB(collectionName, id) {
    // Note: This doesn't automatically delete the image from Storage to keep it simple,
    // but in a production app you should delete the file too.
    return db.collection(collectionName).doc(id).delete();
}

// --- Helper Functions ---

async function uploadFile(fileOrBlob, folder) {
    let extension = '';

    // If it's a File object (has name property), try to get extension
    if (fileOrBlob.name) {
        const parts = fileOrBlob.name.split('.');
        if (parts.length > 1) {
            extension = '.' + parts.pop();
        }
    }
    // If it's a Blob with type, we could guess, but File object is safer for exact extension.
    // Fallback if no extension found but type is known (optional improvement)

    const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}${extension}`;
    const ref = storage.ref(`${folder}/${filename}`);
    await ref.put(fileOrBlob);
    return await ref.getDownloadURL();
}

// Helper to convert File to Blob (kept for compatibility with admin.js logic if needed)
async function fileToBlob(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Blob([reader.result], { type: file.type }));
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}
