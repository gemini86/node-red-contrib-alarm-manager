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
		node.alarmManager = RED.nodes.getNode(config.alarmManager);
		
		if (node.alarmManager) {
			if (node.debug) {
				node.warn('Registering node with manager...' + node.alarmId);
			}
			node.alarm = node.alarmManager.registerAlarmNode(node, (result) => {
				node.warn(result);
			}, (err, msg) => {
				node.error(err, msg);
			});

			if (node.debug) {
				node.warn('Alarm found in alarm manager: ' + JSON.stringify(node.alarm));
			}
			if (node.alarm) {
				node.status({ text: `Alarm condition: ${node.alarm.type} - ${node.alarm.value}/${node.alarm.limit}`, shape: 'dot', fill: 'red' });
			}
		}

		node.on('input', function (msg) {
			if (typeof msg.payload != 'number') {
				node.error('Error: payload must be a number', msg);
			} else {
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

					if (node.debug) {
						node.warn('alarm pending: ' + JSON.stringify(node.alarm));
					}

					if (node.alarmSent) {
						node.alarmManager.setAlarm(msg);
					} else {
						if (!node.alarmTimer) {
							//start timer to hold pending alarm before sending to the alarm manager.
							node.alarmTimer = setTimeout(() => {
								node.status({ text: `Alarm condition: ${node.alarm.type} - ${node.alarm.value}/${node.alarm.limit}`, shape: 'dot', fill: 'red' });
								if (node.debug) {
									node.warn('alarm sent: ' + JSON.stringify(node.alarm));
								}
								node.alarmManager.setAlarm(msg);
								node.alarmSent = true;
							}, node.delayInterval);
						}
					}

					//update status TODO
					node.status({ text: `Alarm pending: ${msg.payload.type} - ${msg.payload.value}/${msg.payload.limit}`, shape: 'ring', fill: 'red' });
				} else if (msg.payload <= this.lowAlarm) {
					//store pending alarm
					node.alarm = {
						id: node.alarmId,
						timestamp: Date.now(),
						type: 'low',
						limit: node.lowAlarm,
						value: msg.payload
					};

					msg.payload = node.alarm;

					if (node.debug) {
						node.warn('Alarm pending: ' + JSON.stringify(node.alarm));
					}

					if (node.alarmSent) {
						node.alarmManager.setAlarm(msg);
					} else {
						if (!node.alarmTimer) {
							//start timer to hold pending alarm before sending to the alarm manager.
							node.alarmTimer = setTimeout(() => {
								node.status({ text: `Alarm condition: ${msg.payload.type} - ${msg.payload.value}/${msg.payload.limit}`, shape: 'dot', fill: 'red' });
								if (node.debug) {
									node.warn('Alarm sent: ' + JSON.stringify(node.alarm));
								}
								node.alarmManager.setAlarm(msg);
								node.alarmSent = true;
							}, node.delayInterval);
						}
					}
					//update status TODO
					node.status({ text: `Alarm pending: ${msg.payload.type} - ${msg.payload.value}/${msg.payload.limit}`, shape: 'ring', fill: 'red' });
				} else {
					if (node.alarm) {
						if (node.alarmSent) {
							//clear sent alarm alarm
							node.alarm.type = 'clear';
							node.alarm.clearTimestamp = Date.now();
							msg.payload = node.alarm;
							node.alarmManager.clearAlarm(msg);
							node.alarmSent = false;
						} else {
							//cancel pending alarm
							clearTimeout(node.alarmTimer);
							delete node.alarmTimer;
						}
						
						node.status({ text: `Alarm cleared: ${msg.payload.value}`, shape: 'dot', fill: 'green' });
						
						delete node.alarm;
					}
					//update status TODO
					setTimeout(() => {
						node.status({});
					}, 3000);
				}
			}
		});

		node.on('close', function () {
			node.alarmManager.unregisterAlarmNode(node);
		});

	}
	RED.nodes.registerType('condition-monitor', ConditionMonitorNode);
};
