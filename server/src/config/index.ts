export default {
  default: {
    emailTemplate: {
      enabled: true,
      path: 'templates',
      subject: 'Email',
      rateLimitDelay: 1000, // 1 second delay between emails
    },
  },
  validator(config) {
    if (config.emailTemplate) {
      if (config.emailTemplate.rateLimitDelay && typeof config.emailTemplate.rateLimitDelay !== 'number') {
        throw new Error('emailTemplate.rateLimitDelay must be a number');
      }
      if (config.emailTemplate.rateLimitDelay && config.emailTemplate.rateLimitDelay < 0) {
        throw new Error('emailTemplate.rateLimitDelay must be a positive number');
      }
    }
  },
};
