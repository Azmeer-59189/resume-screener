const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Generate embeddings for text
exports.generateEmbedding = async (text) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    logger.error('Embedding generation failed:', error);
    throw error;
  }
};

// Analyze resume against job description using RAG context
exports.analyzeResumeMatch = async (jobDescription, requiredSkills, resumeChunks, candidateName) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const context = resumeChunks.join('\n\n');

    const prompt = `
You are an expert HR recruiter and talent acquisition specialist. Analyze the following resume content against the job requirements and provide a detailed assessment.

JOB REQUIREMENTS:
${jobDescription}

REQUIRED SKILLS:
${requiredSkills.join(', ')}

CANDIDATE RESUME CONTENT:
${context}

Provide your analysis in the following JSON format ONLY (no other text):
{
  "matchScore": <number 0-100>,
  "recommendation": "<one of: strong_match, good_match, partial_match, not_suitable>",
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill1", "skill2"],
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2"],
  "experienceSummary": "<2-3 sentence summary of candidate experience>",
  "aiAnalysis": "<3-4 sentence detailed analysis of why this candidate is or isn't a good fit>"
}

Scoring guide:
- 85-100: strong_match (exceptional fit)
- 70-84: good_match (solid candidate)
- 50-69: partial_match (has potential but gaps)
- 0-49: not_suitable (significant gaps)
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response format');

    const analysis = JSON.parse(jsonMatch[0]);
    logger.info(`AI analysis complete for ${candidateName}: score ${analysis.matchScore}`);
    return analysis;
  } catch (error) {
    logger.error('AI analysis failed:', error);
    throw error;
  }
};

// Generate job description suggestions
exports.improveJobDescription = async (title, description) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
Improve this job posting and extract structured data.
Title: ${title}
Description: ${description}

Return JSON only:
{
  "improvedDescription": "<improved description>",
  "suggestedSkills": ["skill1", "skill2"],
  "experienceLevel": "<entry|mid|senior|lead>"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    logger.error('Job improvement failed:', error);
    throw error;
  }
};