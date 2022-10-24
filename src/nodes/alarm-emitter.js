module.exports = function (RED) {
	function AlarmEmitterNode(config) {
		RED.nodes.createNode(this, config);
		let node = this;
		node.alarmManager = RED.nodes.getNode(config.alarmManager).manager;

		node.alarmManager.on('alarms', (msg) => {
			node.send(msg);
		});

	}
	RED.nodes.registerType('alarm emitter', AlarmEmitterNode);
};
