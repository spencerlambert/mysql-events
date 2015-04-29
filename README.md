# mysql-events
A node meteor package that watches a MySQL database and runs callbacks on matched events.

#Usage
{
	if (Meteor.isServer) {
	
		MySQLEvents.connect({
			host: '<db_hostname>',
			user: '<db_username>',
			password: '<db_pasword>'
		});
	
		var one = MySQLEvents.add('leaderboard', function (oldRow, newRow) {
			console.log('leaderboard - database');
		});
	
		MySQLEvents.add('leaderboard.players', function (oldRow, newRow) {
			console.log('leaderboard.players - table');
			console.log(oldRow);
			console.log(newRow);
		});
	
		MySQLEvents.add('leaderboard.players.name', function (oldRow, newRow) {
			console.log('leaderboard.players.name - column w/o passed in value');
		});
	
		MySQLEvents.add('leaderboard.players.score', function (oldRow, newRow) {
			console.log('leaderboard.players.score - column w/ passed in value');
		}, '100');
	
	
		MySQLEvents.add('leaderboard.players.name.value', function (oldRow, newRow) {
			console.log('leaderboard.players.name.value - column.value w/ passed in value');
		}, 'Maxwell');
	
		MySQLEvents.add('leaderboard.players.name.regexp', function (oldRow, newRow) {
			console.log('leaderboard.players.name.regexp - column.regexp w/ passed in regexp');
		}, /Kep/i);
	
	//	MySQLEvents.remove(one); //removes the triger
	//	MySQLEvents.stop(); //removes all trigger
	}
}