# mysql-events
A node meteor package that watches a MySQL database and runs callbacks on matched events.

This package is based on the [ZongJi](https://github.com/nevill/zongji) node module. Please make sure that you meet the requirements described at [ZongJi](https://github.com/nevill/zongji), like MySQL binlog etc.

#Quick Start
```javascript
var MySQLEvents = require('mysql-events');
var dsn = {
  host:     _dbhostname_,
  user:     _dbusername_,
  password: _dbpassword_,
};
var mysqlEventWatcher = MySQLEvents(dsn);
var watcher =mysqlEventWatcher.add(
  'myDB.table.field.value',
  function (oldRow, newRow) {
     //row inserted
    if (oldRow === null) {
      //insert code goes here
    }

     //row deleted
    if (newRow === null) {
      //delete code goes here
    }

     //row updated
    if (oldRow !== null && newRow !== null) {
      //update code goes here
    }
  }, 
  'match this string or regex'
);
```

#Installation
```sh
npm install mysql-events
```

#Usage
- Import the module into your application
```javascript
var MySQLEvents = require('mysql-events');
```

- Instantiate and create a database connection
```sh
var dsn = {
  host:     'localhost',
  user:     'username',
  password: 'password'
};
var myCon = MySQLEvents(dsn);
```

Make sure the database user has the privilege to read the binlog on database that you want to watch on.

- Use the returned object to add new watchers
```sh
var event1 = myCon.add(
  'dbName.tableName.fieldName.value',
  function (oldRow, newRow) {
    //code goes here
  }, 
  'Active'
);
```

This will listen to any change in the _fieldName_ and if the changed value is equal to __Active__, then triggers the callback. Passing it 2 arguments. Argument value depends on the event.

- Insert: oldRow = null, newRow = rowObject
- Update: oldRow = rowObject, newRow = rowObject
- Delete: oldRow = rowObject, newRow = null

###rowObject
It has the following structure:

```
{
  database: dbName,
  table: tableName,
  affectedColumns: {
    [{
      name:     fieldName1,
      charset:  String,
      type:     Number
      metedata: String
    },{
      name:     fieldName2,
      charset:  String,
      type:     Number
      metedata: String
    }]
},{
  changedColumns: [fieldName1, fieldName2],
  fields: {
   fieldName1: recordValue1,
   fieldName2: recordValue2,
     ....
     ....
     ....
   fieldNameN: recordValueN
  }
}
```

##Remove an event
```
event1.remove();
```

##Stop all events on the connection
```
myCon.stop();
```

#Watcher Setup
Its basically a dot '.' seperated string. It can have the following combinations

- _database_: watches the whole database for changes (insert/update/delete). Which table and row are affected can be inspected from the oldRow & newRow
- _database.table_: watches the whole table for changes. Which rows are affected can be inspected from the oldRow & newRow
- _database.table.column_: watches for changes in the column. Which database, table & other changed columns can be inspected from the oldRow & newRow
- _database.table.column.value_: watches for changes in the column and only trigger the callback if the changed value is equal to the 3rd argument passed to the add().
- _database.table.column.regexp_: watches for changes in the column and only trigger the callback if the changed value passes a regular expression test to the 3rd argument passed to the add(). The 3rd argument must be a Javascript Regular Expression Object, like, if you want to match for a starting sting (eg: MySQL) in the value, use /MySQL/i. This will trigger the callback only if the new value starts with MySQL

#LICENSE
MIT
