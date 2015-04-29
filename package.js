Package.describe({
  name: 'mysql-events',
  version: '0.0.1',
  // Brief, one-line summary of the package.
  summary: 'A node meteor package that watches a MySQL database and runs callbacks on matched events',
  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/spencerlambert/mysql-events',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.0.3.2');
  api.use([
	'meteor',
	'meteor-platform',
    'meteor-tool',
	'numtel:mysql'
  ]);
  api.addFiles('mysql-events.js');
  api.export('MySQLEvents');
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use('mysql-events');
  api.addFiles('mysql-events-tests.js');
});

Npm.depends({
  'zongji': '0.3.2'
});