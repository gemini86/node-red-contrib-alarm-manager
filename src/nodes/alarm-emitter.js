module.exports = function (RED) {
	function AlarmEmitterNode(config) {
		RED.nodes.createNode(this, config);
		let node = this;
		node.alarmManager = RED.nodes.getNode(config.alarmManager);
		node.delayInterval = config.delayMinutes * 60000;
		node.resendInterval = config.resendMinutes * 60000;

		node.alarmManager.on('alarmEmit', (msg) => {
			node.send(msg);
		});

	}
	RED.nodes.registerType('alarm emitter', AlarmEmitterNode);
};