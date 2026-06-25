const errorResponse = description => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' }
    }
  }
});

const bearerSecurity = [{ bearerAuth: [] }];

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'ResumeAI API',
    version: '1.0.0',
    description: [
      'Interactive API documentation for the ResumeAI recruitment platform.',
      '',
      'Recruiter endpoints require a JWT. Call **POST /api/auth/login**, copy the returned token,',
      'click **Authorize**, and enter the token without the `Bearer` prefix.',
      '',
      'Candidate application endpoints are public and do not require an account.'
    ].join('\n')
  },
  servers: [
    { url: 'http://localhost:5000', description: 'Local development server' }
  ],
  tags: [
    { name: 'System', description: 'API health and metadata' },
    { name: 'Authentication', description: 'Recruiter authentication' },
    { name: 'Jobs - Public', description: 'Public job discovery and application details' },
    { name: 'Jobs - Recruiter', description: 'Authenticated job management' },
    { name: 'Applications - Public', description: 'Account-free candidate applications' },
    { name: 'Applications - Recruiter', description: 'Authenticated application review' },
    { name: 'Recruiter', description: 'Recruiter dashboard data' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Check API health',
        responses: {
          200: {
            description: 'API is running',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a recruiter',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' }
            }
          }
        },
        responses: {
          201: {
            description: 'Recruiter registered',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' }
              }
            }
          },
          400: errorResponse('Missing fields or email already registered'),
          500: errorResponse('Server error')
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Log in as a recruiter',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' }
              }
            }
          },
          401: errorResponse('Invalid credentials'),
          403: errorResponse('Candidate accounts cannot log in')
        }
      }
    },
    '/api/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get the authenticated recruiter',
        security: bearerSecurity,
        responses: {
          200: {
            description: 'Current recruiter',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          },
          401: errorResponse('Missing or invalid token')
        }
      }
    },
    '/api/jobs': {
      get: {
        tags: ['Jobs - Public'],
        summary: 'List active jobs',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['full-time', 'part-time', 'contract', 'internship'] } },
          { name: 'experienceLevel', in: 'query', schema: { type: 'string', enum: ['entry', 'mid', 'senior', 'lead'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, default: 20 } }
        ],
        responses: {
          200: {
            description: 'Paginated active jobs',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JobListResponse' }
              }
            }
          }
        }
      },
      post: {
        tags: ['Jobs - Recruiter'],
        summary: 'Create a job',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/JobInput' }
            }
          }
        },
        responses: {
          201: {
            description: 'Job created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    job: { $ref: '#/components/schemas/Job' },
                    applyLink: { type: 'string' }
                  }
                }
              }
            }
          },
          400: errorResponse('Invalid job input'),
          401: errorResponse('Missing or invalid token')
        }
      }
    },
    '/api/jobs/apply/{jobId}': {
      get: {
        tags: ['Jobs - Public'],
        summary: 'Get a job by its public job ID',
        parameters: [{ $ref: '#/components/parameters/JobId' }],
        responses: {
          200: {
            description: 'Job details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { job: { $ref: '#/components/schemas/Job' } }
                }
              }
            }
          },
          404: errorResponse('Job not found')
        }
      }
    },
    '/api/jobs/my': {
      get: {
        tags: ['Jobs - Recruiter'],
        summary: 'List the authenticated recruiter’s jobs',
        security: bearerSecurity,
        responses: {
          200: {
            description: 'Recruiter jobs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    jobs: { type: 'array', items: { $ref: '#/components/schemas/Job' } }
                  }
                }
              }
            }
          },
          401: errorResponse('Missing or invalid token')
        }
      }
    },
    '/api/jobs/manage/{id}': {
      get: {
        tags: ['Jobs - Recruiter'],
        summary: 'Get one owned job for editing',
        security: bearerSecurity,
        parameters: [{ $ref: '#/components/parameters/MongoId' }],
        responses: {
          200: {
            description: 'Owned job',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { job: { $ref: '#/components/schemas/Job' } }
                }
              }
            }
          },
          404: errorResponse('Job not found')
        }
      }
    },
    '/api/jobs/{id}': {
      put: {
        tags: ['Jobs - Recruiter'],
        summary: 'Update a job and re-score its applications',
        security: bearerSecurity,
        parameters: [{ $ref: '#/components/parameters/MongoId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/JobInput' }
            }
          }
        },
        responses: {
          200: {
            description: 'Updated job and re-score count',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    job: { $ref: '#/components/schemas/Job' },
                    rescoredApplications: { type: 'integer' }
                  }
                }
              }
            }
          },
          400: errorResponse('Invalid job input'),
          404: errorResponse('Job not found')
        }
      },
      delete: {
        tags: ['Jobs - Recruiter'],
        summary: 'Delete a job and all related application data',
        description: 'Deletes applications, resume records, local PDF files, job vectors, and candidate records that have no remaining applications.',
        security: bearerSecurity,
        parameters: [{ $ref: '#/components/parameters/MongoId' }],
        responses: {
          200: {
            description: 'Job and related data deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    deletedApplications: { type: 'integer' },
                    deletedResumes: { type: 'integer' }
                  }
                }
              }
            }
          },
          404: errorResponse('Job not found')
        }
      }
    },
    '/api/jobs/{id}/status': {
      patch: {
        tags: ['Jobs - Recruiter'],
        summary: 'Change job status',
        security: bearerSecurity,
        parameters: [{ $ref: '#/components/parameters/MongoId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['active', 'paused', 'closed'] }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Status changed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    job: { $ref: '#/components/schemas/Job' }
                  }
                }
              }
            }
          },
          400: errorResponse('Invalid status'),
          404: errorResponse('Job not found')
        }
      }
    },
    '/api/jobs/{id}/match': {
      get: {
        tags: ['Jobs - Recruiter'],
        summary: 'Get Pinecone vector matches for a job',
        security: bearerSecurity,
        parameters: [{ $ref: '#/components/parameters/MongoId' }],
        responses: {
          200: { description: 'Ranked vector matches' },
          403: errorResponse('Not authorized'),
          404: errorResponse('Job not found')
        }
      }
    },
    '/api/applications/jobs/{jobId}/apply': {
      post: {
        tags: ['Applications - Public'],
        summary: 'Apply to a job without an account',
        description: 'Uploads a real PDF up to 10 MB, extracts its text, creates an application, and calculates an immediate baseline score.',
        parameters: [{ $ref: '#/components/parameters/JobId' }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['fullName', 'email', 'resume'],
                properties: {
                  fullName: { type: 'string', example: 'Jane Smith' },
                  email: { type: 'string', format: 'email', example: 'jane@example.com' },
                  coverLetter: { type: 'string' },
                  resume: { type: 'string', format: 'binary', description: 'PDF file, maximum 10 MB' }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Application submitted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    applicationId: { type: 'string' },
                    baselineScore: { type: 'number', minimum: 0, maximum: 100 }
                  }
                }
              }
            }
          },
          400: errorResponse('Missing fields, invalid PDF, closed job, or passed deadline'),
          404: errorResponse('Job not found'),
          409: errorResponse('Duplicate application or recruiter email conflict')
        }
      }
    },
    '/api/applications/job/{jobId}': {
      get: {
        tags: ['Applications - Recruiter'],
        summary: 'Get ranked applications for an owned job',
        security: bearerSecurity,
        parameters: [{ $ref: '#/components/parameters/JobId' }],
        responses: {
          200: {
            description: 'Ranked applications',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    applications: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Application' }
                    },
                    job: { $ref: '#/components/schemas/Job' }
                  }
                }
              }
            }
          },
          404: errorResponse('Job not found')
        }
      }
    },
    '/api/applications/{id}/resume': {
      get: {
        tags: ['Applications - Recruiter'],
        summary: 'Download an applicant’s PDF resume',
        security: bearerSecurity,
        parameters: [{ $ref: '#/components/parameters/MongoId' }],
        responses: {
          200: {
            description: 'PDF resume',
            content: {
              'application/pdf': {
                schema: { type: 'string', format: 'binary' }
              }
            }
          },
          403: errorResponse('Not authorized'),
          404: errorResponse('Application or file not found')
        }
      }
    },
    '/api/applications/{id}/status': {
      patch: {
        tags: ['Applications - Recruiter'],
        summary: 'Update application status and recruiter notes',
        security: bearerSecurity,
        parameters: [{ $ref: '#/components/parameters/MongoId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { $ref: '#/components/schemas/ApplicationStatus' },
                  recruiterNotes: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Application updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    application: { $ref: '#/components/schemas/Application' }
                  }
                }
              }
            }
          },
          400: errorResponse('Invalid application status'),
          403: errorResponse('Not authorized'),
          404: errorResponse('Application not found')
        }
      }
    },
    '/api/applications/{id}/reprocess': {
      post: {
        tags: ['Applications - Recruiter'],
        summary: 'Re-run scoring for an application',
        security: bearerSecurity,
        parameters: [{ $ref: '#/components/parameters/MongoId' }],
        responses: {
          200: {
            description: 'Background processing started',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { message: { type: 'string' } }
                }
              }
            }
          },
          403: errorResponse('Not authorized'),
          404: errorResponse('Application not found')
        }
      }
    },
    '/api/recruiter/dashboard': {
      get: {
        tags: ['Recruiter'],
        summary: 'Get recruiter dashboard statistics',
        security: bearerSecurity,
        responses: {
          200: {
            description: 'Dashboard statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    totalJobs: { type: 'integer' },
                    activeJobs: { type: 'integer' },
                    totalApplications: { type: 'integer' },
                    shortlisted: { type: 'integer' },
                    recentApplications: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Application' }
                    }
                  }
                }
              }
            }
          },
          401: errorResponse('Missing or invalid token')
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    parameters: {
      MongoId: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'MongoDB document ID',
        schema: { type: 'string', example: '665f10c53fd7e7e20ccbe123' }
      },
      JobId: {
        name: 'jobId',
        in: 'path',
        required: true,
        description: 'Public readable job ID',
        schema: { type: 'string', example: 'JOB-1782385658554-EDADDE' }
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' }
        }
      },
      RegisterRequest: {
        type: 'object',
        required: ['fullName', 'email', 'password', 'company'],
        properties: {
          fullName: { type: 'string', example: 'Alex Recruiter' },
          email: { type: 'string', format: 'email', example: 'alex@company.com' },
          password: { type: 'string', format: 'password', minLength: 6 },
          company: { type: 'string', example: 'Acme Inc.' }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' }
        }
      },
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: { $ref: '#/components/schemas/User' }
        }
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          id: { type: 'string' },
          fullName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['recruiter', 'candidate', 'admin'] },
          company: { type: 'string' }
        }
      },
      JobInput: {
        type: 'object',
        required: ['title', 'description', 'requirements', 'requiredSkills'],
        properties: {
          title: { type: 'string', example: 'Senior Python Developer' },
          description: { type: 'string' },
          requirements: { type: 'array', minItems: 1, items: { type: 'string' } },
          requiredSkills: { type: 'array', minItems: 1, items: { type: 'string' }, example: ['Python', 'Django', 'PostgreSQL'] },
          niceToHaveSkills: { type: 'array', items: { type: 'string' } },
          location: { type: 'string', example: 'Remote' },
          type: { type: 'string', enum: ['full-time', 'part-time', 'contract', 'internship'] },
          experienceLevel: { type: 'string', enum: ['entry', 'mid', 'senior', 'lead'] },
          deadline: { type: 'string', format: 'date-time', nullable: true },
          salary: {
            type: 'object',
            properties: {
              min: { type: 'number' },
              max: { type: 'number' },
              currency: { type: 'string', example: 'USD' }
            }
          }
        }
      },
      Job: {
        allOf: [
          { $ref: '#/components/schemas/JobInput' },
          {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              jobId: { type: 'string' },
              company: { type: 'string' },
              status: { type: 'string', enum: ['active', 'paused', 'closed'] },
              applyLink: { type: 'string' },
              totalApplications: { type: 'integer' },
              shortlisted: { type: 'integer' },
              rejected: { type: 'integer' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          }
        ]
      },
      JobListResponse: {
        type: 'object',
        properties: {
          jobs: { type: 'array', items: { $ref: '#/components/schemas/Job' } },
          total: { type: 'integer' },
          page: { type: 'integer' },
          pages: { type: 'integer' }
        }
      },
      ApplicationStatus: {
        type: 'string',
        enum: ['applied', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'rejected']
      },
      ScoreBreakdown: {
        type: 'object',
        properties: {
          skillScore: { type: 'number' },
          contextScore: { type: 'number' },
          skillWeight: { type: 'number' },
          contextWeight: { type: 'number' },
          matchedSkillCount: { type: 'integer' },
          totalSkillCount: { type: 'integer' },
          matchedTermCount: { type: 'integer' },
          totalTermCount: { type: 'integer' },
          matchedTerms: { type: 'array', items: { type: 'string' } },
          formula: { type: 'string' }
        }
      },
      Application: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          candidate: { $ref: '#/components/schemas/User' },
          resume: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              originalFileName: { type: 'string' },
              isProcessed: { type: 'boolean' }
            }
          },
          matchScore: { type: 'number', minimum: 0, maximum: 100 },
          matchedSkills: { type: 'array', items: { type: 'string' } },
          missingSkills: { type: 'array', items: { type: 'string' } },
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
          scoreBreakdown: { $ref: '#/components/schemas/ScoreBreakdown' },
          scoringMethod: { type: 'string', enum: ['local', 'ai', 'vector'] },
          aiAnalysis: { type: 'string' },
          recommendation: { type: 'string', enum: ['strong_match', 'good_match', 'partial_match', 'not_suitable'] },
          status: { $ref: '#/components/schemas/ApplicationStatus' },
          recruiterNotes: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  }
};
