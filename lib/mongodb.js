import { MongoClient } from 'mongodb';

// Shared MongoClient promise for the Auth.js MongoDB adapter and the
// credentials/register route handlers. A dummy fallback URI keeps `next build`
// and page rendering working without secrets; a real MONGODB_URI is required for
// authentication to actually function (the connection is only opened on a real
// sign-in / register request, never during build or JWT session reads).
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dotori';
const options = {};

let clientPromise;

if (process.env.NODE_ENV === 'development') {
  // Reuse the client across HMR reloads in dev.
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri, options).connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = new MongoClient(uri, options).connect();
}

export default clientPromise;
