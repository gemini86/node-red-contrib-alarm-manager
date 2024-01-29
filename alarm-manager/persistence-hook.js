module.exports = function (RED) {
	function PersistenceHookNode(config) {
		RED.nodes.createNode(this, config);
		let node = this;
		node.debug = config.debug;
		node.alarmManager = RED.nodes.getNode(config.alarmManager);

		if (node.alarmManager) {
			if (node.debug) {
				node.warn('connected to ' + node.alarmManager.name);
			}
			node.status({ text: 'connected to ' + node.alarmManager.name, shape: 'dot', fill: 'green' });

			node.on('input', (msg, send, done) => {
				send = send || function () {
					node.send.apply(node, arguments);
				};

				if (msg.reset) {
					node.alarmManager.clearAllAlarms();
					send([{}]);
				}
				if (msg.payload) {
					node.alarmManager.loadAlarms(msg.payload);
				}

				if (done) {
					done();
				}
			});
		}
	}
	RED.nodes.registerType('persistence-hook', PersistenceHookNode);
};
