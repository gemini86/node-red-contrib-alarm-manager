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

			node.alarmManager.on('alarms', (msg) => {
				node.send(msg);
			});
		}
	}
	RED.nodes.registerType('alarm-emitter', AlarmEmitterNode);
};
