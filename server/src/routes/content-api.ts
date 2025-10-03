export default [
  {
    method: 'GET',
    path: '/',
    // name of the controller file & the method.
    handler: 'controller.index',
    config: {
      policies: [],
    },
  },
  {
    method: 'GET',
    path: '/templates',
    handler: 'controller.getTemplates',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
      auth: {
        scope: ['admin::isAuthenticatedAdmin'],
      },
    },
  },
  {
    method: 'GET',
    path: '/templates/:templatePath',
    handler: 'controller.getTemplateContent',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
      auth: {
        scope: ['admin::isAuthenticatedAdmin'],
      },
    },
  },
  {
    method: 'POST',
    path: '/send-bulk-emails',
    handler: 'controller.sendBulkEmails',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
      auth: {
        scope: ['admin::isAuthenticatedAdmin'],
      },
    },
  },
];
