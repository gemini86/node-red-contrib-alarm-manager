module.exports = function (RED) {
	function AlarmEmitterNode(config) {
		RED.nodes.createNode(this, config);
		let node = this;
		node.debug = config.debug;
		node.alarmManager = RED.nodes.getNode(config.alarmManager);

		if (node.alarmManager) {
			if (node.debug) {
				node.warn('connected to ' + node.alarmManager.name);
			}
			node.status({ text: 'connected to ' + node.alarmManager.name, shape: 'dot', fill: 'green' });

			node.alarmManager.on('alarms', (msg) => {
				let copy = RED.util.cloneMessage(msg);
				node.send([copy, null, null]);
			});

			node.alarmManager.on('persist', (msg) => {
				let copy = RED.util.cloneMessage(msg);
				node.send([null, copy, null]);
			});

			node.alarmManager.on('alarmEvent', (msg) => {
				let copy = RED.util.cloneMessage(msg);
				node.send([null, null, copy]);
			});
		}
	}
	RED.nodes.registerType('alarm-emitter', AlarmEmitterNode);
};
