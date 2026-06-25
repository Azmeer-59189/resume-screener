const { Pinecone } = require('@pinecone-database/pinecone');
const logger = require('../utils/logger');

let index = null;

const getIndex = async () => {
  if (index) return index;
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  index = pc.index(process.env.PINECONE_INDEX || 'resume-screener');
  logger.info('Pinecone index connected');
  return index;
};

// Store resume chunk embeddings in Pinecone
exports.storeEmbeddings = async (candidateId, jobId, chunks, embeddings) => {
  try {
    const idx = await getIndex();
    const vectors = chunks.map((chunk, i) => ({
      id: `${candidateId}_${jobId}_chunk_${i}`,
      values: embeddings[i],
      metadata: {
        candidateId,
        jobId,
        chunkText: chunk.text,
        chunkIndex: i
      }
    }));

    await idx.upsert(vectors);
    logger.info(`Stored ${vectors.length} vectors for candidate ${candidateId}`);
    return vectors.map(v => v.id);
  } catch (error) {
    logger.error('Pinecone store failed:', error);
    throw error;
  }
};

// Search for relevant resume chunks matching a job description
exports.searchSimilarChunks = async (jobEmbedding, jobId = null, topK = 10) => {
  try {
    const idx = await getIndex();
    const queryObj = {
      vector: jobEmbedding,
      topK,
      includeMetadata: true
    };

    // If a jobId is provided, apply a filter to restrict results to that job's indexed vectors.
    // Otherwise perform a global search across all indexed resume chunks.
    if (jobId) queryObj.filter = { jobId };

    const results = await idx.query(queryObj);

    return (results.matches || []).map(m => ({
      text: m.metadata.chunkText,
      score: m.score,
      candidateId: m.metadata.candidateId
    }));
  } catch (error) {
    logger.error('Pinecone search failed:', error);
    throw error;
  }
};

// Delete all vectors for a candidate
exports.deleteCandidate = async (candidateId) => {
  try {
    const idx = await getIndex();
    await idx.deleteMany({ filter: { candidateId } });
    logger.info(`Deleted vectors for candidate ${candidateId}`);
  } catch (error) {
    logger.error('Pinecone delete failed:', error);
  }
};