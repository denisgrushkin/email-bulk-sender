import type { Core } from '@strapi/strapi';
import * as fs from 'fs';
import * as path from 'path';

// Email validation utility
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Enhanced template renderer
const renderTemplate = (template: string, data: Record<string, any>): string => {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match;
  });
};

interface EmailBulkSenderConfig {
  emailTemplate?: {
    enabled?: boolean;
    path?: string;
    rateLimitDelay?: number; // Delay between emails in milliseconds
  };
}

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  index(ctx) {
    ctx.body = strapi
      .plugin('email-bulk-sender')
      // the name of the service file & the method.
      .service('service')
      .getWelcomeMessage();
  },

  async getTemplates(ctx) {
    try {
      const config = strapi.config.get('plugin.email-bulk-sender') as EmailBulkSenderConfig;
      const templatePath = config?.emailTemplate?.path || 'templates';
      const fullPath = path.resolve(process.cwd(), templatePath);

      if (!fs.existsSync(fullPath)) {
        ctx.body = { templates: [] };
        return;
      }

      const files = fs.readdirSync(fullPath);
      const templates = files
        .filter(file => file.endsWith('.html'))
        .map(file => ({
          name: path.basename(file, '.html'),
          path: path.join(templatePath, file),
          filename: file
        }));

      ctx.body = { templates };
    } catch (error) {
      strapi.log.error('Error getting templates:', error);
      ctx.status = 500;
      ctx.body = { error: 'Failed to get templates' };
    }
  },

  async getTemplateContent(ctx) {
    try {
      const { templatePath } = ctx.params;
      const config = strapi.config.get('plugin.email-bulk-sender') as EmailBulkSenderConfig;
      const basePath = config?.emailTemplate?.path || 'templates';
      const fullPath = path.resolve(process.cwd(), basePath, templatePath);

      // Security check: ensure the path is within the templates directory
      const resolvedBasePath = path.resolve(process.cwd(), basePath);
      if (!fullPath.startsWith(resolvedBasePath)) {
        ctx.status = 400;
        ctx.body = { error: 'Invalid template path' };
        return;
      }

      if (!fs.existsSync(fullPath)) {
        ctx.status = 404;
        ctx.body = { error: 'Template not found' };
        return;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      ctx.body = { content };
    } catch (error) {
      strapi.log.error('Error getting template content:', error);
      ctx.status = 500;
      ctx.body = { error: 'Failed to get template content' };
    }
  },

  async sendBulkEmails(ctx) {
    try {
      strapi.log.info('Starting bulk email sending process');

      const { template, subject, documents } = ctx.request.body;

      // Enhanced validation
      if (!template || !subject || !documents || !Array.isArray(documents)) {
        ctx.status = 400;
        ctx.body = { error: 'Template, subject and documents array are required' };
        return;
      }

      if (documents.length === 0) {
        ctx.status = 400;
        ctx.body = { error: 'At least one document is required' };
        return;
      }

      // Validate all email addresses before processing
      const invalidEmails = documents.filter(doc => !doc.email || !isValidEmail(doc.email));
      if (invalidEmails.length > 0) {
        ctx.status = 400;
        ctx.body = {
          error: 'Invalid email addresses found',
          invalidEmails: invalidEmails.map(doc => ({ id: doc.id, email: doc.email }))
        };
        return;
      }

      // Get template content
      const config = strapi.config.get('plugin.email-bulk-sender') as EmailBulkSenderConfig;
      const basePath = config?.emailTemplate?.path || 'templates';
      const rateLimitDelay = config?.emailTemplate?.rateLimitDelay || 1000; // Default 1 second delay

      const templatePath = path.resolve(process.cwd(), basePath, `${template}.html`);

      if (!fs.existsSync(templatePath)) {
        ctx.status = 404;
        ctx.body = { error: 'Template not found' };
        return;
      }

      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const results = [];

      strapi.log.info(`Processing ${documents.length} emails with template: ${template}`);
      strapi.log.info(`Template content: ${templateContent}`);

      // Send emails to each document with rate limiting
      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];

        try {
          // Render template with document data using enhanced renderer
          const renderedContent = renderTemplate(templateContent, {
            email: document.email,
            name: document.name,
            ...document // Include any additional fields from the document
          });

          // Send email using Strapi email plugin
          await strapi.plugins.email.services.email.send({
            to: document.email,
            subject: subject,
            html: renderedContent,
          });

          results.push({
            id: document.id,
            email: document.email,
            status: 'sent',
            success: true
          });

          strapi.log.info(`Email sent successfully to ${document.email} (${i + 1}/${documents.length})`);

          // Rate limiting: add delay between emails (except for the last one)
          if (i < documents.length - 1 && rateLimitDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
          }

        } catch (emailError) {
          strapi.log.error(`Failed to send email to ${document.email}:`, emailError);
          results.push({
            id: document.id,
            email: document.email,
            status: 'failed',
            success: false,
            error: emailError?.response?.data,
            message: emailError.message || 'Unknown error occurred'
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      strapi.log.info(`Bulk email sending completed. ${successCount} sent, ${failureCount} failed.`);

      ctx.body = {
        success: true,
        message: `Bulk email sending completed. ${successCount} sent, ${failureCount} failed.`,
        results,
        summary: {
          total: documents.length,
          sent: successCount,
          failed: failureCount
        }
      };

    } catch (error) {
      strapi.log.error('Error sending bulk emails:', error);
      ctx.status = 500;
      ctx.body = {
        error: 'Failed to send bulk emails',
        details: error.message || 'Unknown error occurred'
      };
    }
  },
});

export default controller;
