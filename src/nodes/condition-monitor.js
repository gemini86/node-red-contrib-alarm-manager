module.exports = function (RED) {
	function ConditionMonitorNode(config) {
		RED.nodes.createNode(this, config);
		let node = this;
		node.alarmId = config.alarmId;
		node.highAlarm = config.highAlarm;
		node.lowAlarm = config.lowAlarm;
		node.delayInterval = config.delayMinutes * 60000;
		node.debug = config.debug;

		//retrive the config node
		node.alarmManager = RED.nodes.getNode(config.alarmManager).manager;
		node.alarm = node.alarmManager.getAlarm(node.alarmId);

		node.on('input', function (msg) {
			if (typeof msg.payload != 'number') {
				node.error('Error: payload must be a number', msg);
			}

			if (msg.payload >= this.highAlarm) {
				//store pending alarm
				node.alarm = {
					id: node.alarmId,
					timestamp: Date.now(),
					type: 'high',
					limit: node.highAlarm,
					value: msg.payload
				};

				msg.payload = node.alarm;

				//start timer to hold pending alarm before sending to the alarm manager.
				node.alarmTimer = setTimeout((msg) => {
					node.status({ text: `Alarm Condition: ${msg.payload.type} - ${msg.payload.value}/${msg.payload.limit}`, shape: 'dot', fill: 'red' });
					if (node.debug) {
						node.info(msg);
					}
					node.alarmManager.setAlarm(msg.payload);
					node.alarmSent = true;
				}, node.delayInterval, msg.payload);

				//update status TODO
			} else if (msg.payload <= this.lowAlarm) {
				//store pending alarm
				node.alarm = {
					id: node.alarmId,
					timestamp: Date.now(),
					type: 'low',
					limit: node.lowAlarm,
					value: msg.payload
				};
				//update status TODO
			} else {
				if (node.alarm) {
					if (node.alarmSent) {
						//clear sent alarm alarm
						node.alarm.type = 'clear';
						node.alarm.clearTimestamp = Date.now();
					} else {
						//cancel pending alarm
						clearTimeout(node.alarmTimer);
						delete node.alarmTimer;
						delete node.alarm;
					}
				}
				//update status TODO
			}
		});

	}
	RED.nodes.registerType('condition monitor', ConditionMonitorNode);
};
