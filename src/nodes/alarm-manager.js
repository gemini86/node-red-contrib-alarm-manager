module.exports = function (RED) {
	function AlarmManagerNode(config) {
		RED.nodes.createNode(this, config);
		let node = this;
		let nodeContext = this.context();

		let currentAlarms = nodeContext.currentAlarms || {};

		node.setAlarm = function (alarm) {
			//first check if an alarm for this id already exists
			if (currentAlarms[alarm.id]) {
				//update the alarm value
				currentAlarms[alarm.id].value = alarm.value;
			} else {
				//set new alarm
				alarm.persistent = false;
				currentAlarms[alarm.id] = alarm;
			}
		};
	}
	RED.nodes.registerType('alarm manager', AlarmManagerNode);
};
