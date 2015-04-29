// Write your package code here!
if (Meteor.isServer) {
	var ZongJi = Npm.require('zongji');

	//Getting SIGINT halt
	process.on('SIGINT', function() {
		if (MySQLEvents.started) {
			MySQLEvents.zongji.stop();
		}
		process.exit();
	});

	MySQLEvents = {
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

		//current event being called
		currentEvent: '',

		//connect - instantiate an ZongJi Class
		connect: function (obj) {
			if (
				! _.isUndefined(obj.host) &&
				! _.isUndefined(obj.user) &&
				! _.isUndefined(obj.password)
			) {
				this.zongji = new ZongJi(obj);
			} else {
				throw new Meteor.Error(500, 'Error: MySQLEvents connect() needs host, user & password');
			}
		},

		//Add a watcher
		add: function (watchon, callback, columnValue) {

			var trigger = {
				trigger: watchon,
				callback: callback
			};
			if (! _.isUndefined(columnValue)) {
				_.extend(trigger, {value: columnValue});
			}

			this.triggers.push(trigger);
			this.reload();

			return trigger;
		},

		//unset watcher - this is the stop() method on the returned object of add() call
		remove: function (trigger) {
			this.triggers = _.reject(this.triggers, function (obj) {
				return _.isEqual(obj, trigger);
			});
			this.reload();
		},

		//Stop all watchers
		stop: function() {
			this.zongji.stop();
		},

		//set the zongji includeSchema based on current watcher list
		reload: function () {

				var map = {
					startAtEnd: true,
					includeEvents: this.events,
					includeSchema: this.includeSchema()
				};

				//check whether ZongJi started
				if (! this.started) {
					this.zongji.start(map);
					this.started = true;
					this.zongji.on('binlog', function(evt) {
						if (evt.getEventName() !== 'tablemap') {
							//console.log(evt.getEventName());
							//console.log(evt.rows);

							var database = evt.tableMap[evt.tableId].parentSchema;
							var table = evt.tableMap[evt.tableId].tableName;
							var columns = evt.tableMap[evt.tableId].columns;
							var oldRow = newRow = {};
							var changedColumns = [];

							_.each(evt.rows, function(row) {
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
									_.each(row.before, function (val, key) {
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
								var dbTriggers = _.filter(MySQLEvents.triggers, function (t) {
																	return t.trigger == database;
																});
								_.each(dbTriggers, function (dbTrigger) {
									dbTrigger.callback.call(dbTrigger, oldRow, newRow);
								});

								//call all database.table callbacks
								var tblTriggers = _.filter(MySQLEvents.triggers, function (t) {
																	return t.trigger == database + '.' + table;
																});
								_.each(tblTriggers, function (tblTrigger) {
									tblTrigger.callback.call(tblTrigger, oldRow, newRow);
								});

								//call all database.table.column, database.table.column, database.table.column.value & database.table.column.regexp callbacks
								_.each(changedColumns, function (col) {
									//value match
									var colTriggers = _.filter(MySQLEvents.triggers, function (t) {
																		return ( (t.trigger == database + '.' + table + '.' + col) || (t.trigger == database + '.' + table + '.' + col + '.value') );
																	});
									_.each(colTriggers, function (colTrigger) {
										if (_.isUndefined(colTrigger.value)) {
											colTrigger.callback.call(colTrigger, oldRow, newRow);
										}
										else if (row.after[col] == colTrigger.value) {
											colTrigger.callback.call(colTrigger, oldRow, newRow);
										}
									});
									//regexp match
									var colTriggers = _.filter(MySQLEvents.triggers, function (t) {
																		return t.trigger == database + '.' + table + '.' + col + '.regexp';
																	});
									_.each(colTriggers, function (colTrigger) {
										if (! _.isUndefined(colTrigger.value) && colTrigger.value.test(row.after[col])) {
											colTrigger.callback.call(colTrigger, oldRow, newRow);
										}
									});
								});
							});//rows
						}//tablemap
					});
				} else {
					//reset the options
					this.zongji.set(map);
				}
		},

		includeSchema: function () {
			var schema = {};

			this.databases = [];
			this.tables = {};
			this.columns = {};

			_.each(this.triggers, function (trigger, i) {
				if (! _.isNull(trigger)) {
					var watcher = trigger.trigger.split('.');

					if (watcher.length == 1) {
						if (_.indexOf(this.MySQLEvents.databases, watcher[0]) == -1)
							this.MySQLEvents.databases.push(watcher[0]);
					}

					if (watcher.length == 2) {
						if (! _.has(this.MySQLEvents.tables, watcher[0])) {
							var map = {};
							map[watcher[0]] = [];
							_.extend(this.MySQLEvents.tables, map);
						}
						this.MySQLEvents.tables[watcher[0]].push(watcher[1]);
					}

					if (watcher.length == 3) {
						var map = {type: 'value'};

						if (! _.has(this.MySQLEvents.columns, watcher[0])) {
							var db = {};
							db[watcher[0]] = [];
							_.extend(this.MySQLEvents.columns, db);
						}
						if (! _.has(this.MySQLEvents.columns[watcher[0]], watcher[1])) {
							var table = {};
							table[watcher[1]] = [];
							_.extend(this.MySQLEvents.columns[watcher[0]], table);
						}
						if (! _.has(this.MySQLEvents.columns[watcher[0]][watcher[1]], watcher[2])) {
							var col = {};
							col[watcher[2]] = [];
							_.extend(this.MySQLEvents.columns[watcher[0]][watcher[1]], col);
						}
						this.MySQLEvents.columns[watcher[0]][watcher[1]][watcher[2]].push(map);
					}

					if (watcher.length == 4) {
						if (watcher[3]=='value' || watcher[3] =='regexp') {
							var map = {
								type: watcher[3]
							};
						} else {
							var map = {
								type: 'value'
							};
						}

						if (! _.has(this.MySQLEvents.columns, watcher[0])) {
							var db = {};
							db[watcher[0]] = [];
							_.extend(this.MySQLEvents.columns, db);
						}
						if (! _.has(this.MySQLEvents.columns[watcher[0]], watcher[1])) {
							var table = {};
							table[watcher[1]] = [];
							_.extend(this.MySQLEvents.columns[watcher[0]], table);
						}
						if (! _.has(this.MySQLEvents.columns[watcher[0]][watcher[1]], watcher[2])) {
							var col = {};
							col[watcher[2]] = [];
							_.extend(this.MySQLEvents.columns[watcher[0]][watcher[1]], col);
						}
						this.MySQLEvents.columns[watcher[0]][watcher[1]][watcher[2]].push(map);
					}
				}
			});

			_.each(this.columns, function (val, db) {
				if (! _.has(schema, db)) schema[db] = [];
				_.each(val, function (table, i) {
					if (_.indexOf(schema[db], table) == -1) schema[db].push(table);
				});
			});

			_.each(this.tables, function (val, db) {
				if (! _.has(schema, db)) schema[db] = [];
				_.each(val, function (table, i) {
					if (_.indexOf(schema[db], table) == -1) schema[db].push(table);
				});
			});

			_.each(this.databases, function (db, i) {
				if (! _.has(schema, db)) schema[db] = true;
			});

			return schema;
		}
	}; //MySQLEvents
}