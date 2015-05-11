var ZongJi = require('zongji');
var _underScore = require('underscore');

var MySQLEvents = function(dsn) {
  var mySQLEvents = {
    //Watching - to check whether the zongji.on() has been called or not
    started: false,

    //zongji instance
    zongji: {},

    //db list which are currenly watching
    databases: [],

    //table list, key will be dbname
    tables: {},

    //column list - 2D Array of objects, [dbname][table][column]
    columns: {},

    //events - unique list of events, thats passed to includeEvents to zongji
    events: ['tablemap', 'writerows', 'updaterows', 'deleterows'],

    //triggers - each MySQLEvents.add() generate an object, stored here
    triggers: [],

    //connect - instantiate an ZongJi Class
    connect: function(dsn) {
      if (!_underScore.isUndefined(dsn.host) &&
        !_underScore.isUndefined(dsn.user) &&
        !_underScore.isUndefined(dsn.password)
      ) {
        this.zongji = new ZongJi(dsn);

        this.zongji.on('error', function(err) {
          //console.log("ZongJi error event", err);
        });
      }
      else {
        throw new Error('Error: MySQLEvents connect() needs host, user & password');
      }
    },

    //Add a watcher
    add: function(watchon, callback, columnValue) {

      var trigger = {
        trigger: watchon,
        callback: callback
      };
      if (!_underScore.isUndefined(columnValue)) {
        _underScore.extend(trigger, {
          value: columnValue
        });
      }

      this.triggers.push(trigger);
      this.reload();

      return trigger;
    },

    //unset watcher - this is the stop() method on the returned object of add() call
    remove: function(trigger) {
      this.triggers = _underScore.reject(this.triggers, function(obj) {
        return _underScore.isEqual(obj, trigger);
      });
      this.reload();
    },

    //Stop all watchers
    stop: function() {
      this.zongji.stop();
    },

    //set the zongji includeSchema based on current watcher list
    reload: function() {

      var map = {
        startAtEnd: true,
        includeEvents: this.events,
        includeSchema: this.includeSchema()
      };

      //check whether ZongJi started
      if (!this.started) {
        this.zongji.start(map);
        this.started = true;

        this.zongji.on('binlog', function(evt) {
          if (
            evt.getEventName() === 'writerows' ||
            evt.getEventName() === 'updaterows' ||
            evt.getEventName() === 'deleterows'
          ) {
            //console.log(evt.getEventName());
            //console.log("zongji ctrlConnection", mySQLEvents.zongji.ctrlConnection.state);

            var database = evt.tableMap[evt.tableId].parentSchema;
            var table = evt.tableMap[evt.tableId].tableName;
            var columns = evt.tableMap[evt.tableId].columns;
            var oldRow = {};
            var newRow = {};
            var changedColumns = [];

            _underScore.each(evt.rows, function(row) {
              //console.log(row);
              if (evt.getEventName() == 'writerows') {
                oldRow = null;
                newRow = {
                  database: database,
                  table: table,
                  affectedColumns: columns,
                  changedColumns: changedColumns,
                  fields: row
                };
              }
              if (evt.getEventName() == 'deleterows') {
                newRow = null;
                oldRow = {
                  database: database,
                  table: table,
                  affectedColumns: columns,
                  changedColumns: changedColumns,
                  fields: row
                };
              }
              if (evt.getEventName() == 'updaterows') {
                //get the changed rows list
                _underScore.each(row.before, function(val, key) {
                  if (row.before[key] != row.after[key]) {
                    changedColumns.push(key);
                  }
                });

                oldRow = {
                  database: database,
                  table: table,
                  affectedColumns: columns,
                  changedColumns: changedColumns,
                  fields: row.before
                };
                newRow = {
                  database: database,
                  table: table,
                  affectedColumns: columns,
                  changedColumns: changedColumns,
                  fields: row.after
                };
              }

              //call all database callbacks
              var dbTriggers = _underScore.filter(mySQLEvents.triggers, function(t) {
                return t.trigger == database;
              });
              _underScore.each(dbTriggers, function(dbTrigger) {
                dbTrigger.callback.call(dbTrigger, oldRow, newRow);
              });

              //call all database.table callbacks
              var tblTriggers = _underScore.filter(mySQLEvents.triggers, function(t) {
                return t.trigger == database + '.' + table;
              });
              _underScore.each(tblTriggers, function(tblTrigger) {
                tblTrigger.callback.call(tblTrigger, oldRow, newRow);
              });

              //call all database.table.column, database.table.column, database.table.column.value & database.table.column.regexp callbacks
              _underScore.each(changedColumns, function(col) {
                //value match
                var colTriggers = _underScore.filter(mySQLEvents.triggers, function(t) {
                  return ((t.trigger == database + '.' + table + '.' + col) || (t.trigger == database + '.' + table + '.' + col + '.value'));
                });
                _underScore.each(colTriggers, function(colTrigger) {
                  if (_underScore.isUndefined(colTrigger.value)) {
                    colTrigger.callback.call(colTrigger, oldRow, newRow);
                  }
                  else if (row.after[col] == colTrigger.value) {
                    colTrigger.callback.call(colTrigger, oldRow, newRow);
                  }
                });
                //regexp match
                var colTriggers = _underScore.filter(mySQLEvents.triggers, function(t) {
                  return t.trigger == database + '.' + table + '.' + col + '.regexp';
                });
                _underScore.each(colTriggers, function(colTrigger) {
                  if (!_underScore.isUndefined(colTrigger.value) && colTrigger.value.test(row.after[col])) {
                    colTrigger.callback.call(colTrigger, oldRow, newRow);
                  }
                });
              });
            }); //rows
          } //tablemap
        });
      }
      else {
        //reset the options
        this.zongji.set(map);
      }
    },

    includeSchema: function() {
      var schema = {};

      this.databases = [];
      this.tables = {};
      this.columns = {};

      _underScore.each(this.triggers, function(trigger, i) {
        if (!_underScore.isNull(trigger)) {
          var watcher = trigger.trigger.split('.');

          if (watcher.length == 1) {
            if (_underScore.indexOf(mySQLEvents.databases, watcher[0]) == -1)
              mySQLEvents.databases.push(watcher[0]);
          }

          if (watcher.length == 2) {
            if (!_underScore.has(mySQLEvents.tables, watcher[0])) {
              var map = {};
              map[watcher[0]] = [];
              _underScore.extend(mySQLEvents.tables, map);
            }
            mySQLEvents.tables[watcher[0]].push(watcher[1]);
          }

          if (watcher.length == 3) {
            var map = {
              type: 'value'
            };

            if (!_underScore.has(mySQLEvents.columns, watcher[0])) {
              var db = {};
              db[watcher[0]] = [];
              _underScore.extend(mySQLEvents.columns, db);
            }
            if (!_underScore.has(mySQLEvents.columns[watcher[0]], watcher[1])) {
              var table = {};
              table[watcher[1]] = [];
              _underScore.extend(mySQLEvents.columns[watcher[0]], table);
            }
            if (!_underScore.has(mySQLEvents.columns[watcher[0]][watcher[1]], watcher[2])) {
              var col = {};
              col[watcher[2]] = [];
              _underScore.extend(mySQLEvents.columns[watcher[0]][watcher[1]], col);
            }
            mySQLEvents.columns[watcher[0]][watcher[1]][watcher[2]].push(map);
          }

          if (watcher.length == 4) {
            if (watcher[3] == 'value' || watcher[3] == 'regexp') {
              var map = {
                type: watcher[3]
              };
            }
            else {
              var map = {
                type: 'value'
              };
            }

            if (!_underScore.has(mySQLEvents.columns, watcher[0])) {
              var db = {};
              db[watcher[0]] = [];
              _underScore.extend(mySQLEvents.columns, db);
            }
            if (!_underScore.has(mySQLEvents.columns[watcher[0]], watcher[1])) {
              var table = {};
              table[watcher[1]] = [];
              _underScore.extend(mySQLEvents.columns[watcher[0]], table);
            }
            if (!_underScore.has(mySQLEvents.columns[watcher[0]][watcher[1]], watcher[2])) {
              var col = {};
              col[watcher[2]] = [];
              _underScore.extend(mySQLEvents.columns[watcher[0]][watcher[1]], col);
            }
            mySQLEvents.columns[watcher[0]][watcher[1]][watcher[2]].push(map);
          }
        }
      });

      _underScore.each(this.columns, function(val, db) {
        if (!_underScore.has(schema, db)) schema[db] = [];
        _underScore.each(val, function(table, i) {
          if (_underScore.indexOf(schema[db], table) == -1) schema[db].push(table);
        });
      });

      _underScore.each(this.tables, function(val, db) {
        if (!_underScore.has(schema, db)) schema[db] = [];
        _underScore.each(val, function(table, i) {
          if (_underScore.indexOf(schema[db], table) == -1) schema[db].push(table);
        });
      });

      _underScore.each(this.databases, function(db, i) {
        if (!_underScore.has(schema, db)) schema[db] = true;
      });

      return schema;
    }
  }; //mySQLEvents

  mySQLEvents.connect(dsn);
  return mySQLEvents;
};

module.exports = MySQLEvents;