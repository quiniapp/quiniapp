module.exports = {
  rules: {
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling', 'index'],
          'object',
          'type',
        ],
        pathGroups: [
          {
            pattern: '@components/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@features/**',
            group: 'internal',
          },
        ],
        'newlines-between': 'always',
      },
    ],
  },
};
