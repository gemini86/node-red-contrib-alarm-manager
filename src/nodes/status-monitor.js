module.exports = function (RED) {
	function StatusMonitorNode(config) {
		RED.nodes.createNode(this, config);
		let node = this;
		this.alarmId = config.alarmId;
		this.highAlarm = config.highAlarm;
		this.lowAlarm = config.lowAlarm;
		this.delayMinutes = config.delayMinutes;
		this.alarmType = config.alarmType;
		this.goodInputs = config.goodInputs;
		this.badInputs = config.badInputs;
		//retrive the config node
		node.alarmManager = RED.nodes.getNode(config.alarmManager);

		function createAlarmObject(value, type) {
			let alarm = {
				id: node.alarmId,
				timestamp: Date.now(),
				type: type,
				value: value
			};
			return alarm;
		}

		function updateStatus(mode, alarm) {
			if (mode == 'alarm' && alarm) {
				node.status({
					text: `Alarm ${node.alarmSent ? 'fault' : 'pending'}: ${node.alarm.type}`,
					shape: node.alarmSent ? 'dot' : 'ring',
					fill: 'red'
				});
			} else if (mode == 'disabled') {
				node.status({
					text: 'Node disabled',
					shape: 'dot',
					fill: 'grey'
				});
			} else if (mode == 'enabled' || mode == 'clear') {
				node.status({
					text: mode == 'clear' ? `Alarm cleared: ${alarm.value}` : 'Node enabled',
					shape: 'dot',
					fill: 'green'
				});
				setTimeout(() => {
					if (node.alarm) {
						updateStatus('alarm', node.alarm);
					} else if (node.enabled == false) {
						return;
					} else {
						node.status({});
					}
				}, 3000);
			}
		}

		if (node.alarmManager) {
			if (node.debug) {
				node.warn('Registering node with manager...' + node.alarmId);
			}
			node.alarm = node.alarmManager.registerAlarmNode(node, (err, alarmNode) => {
				node.error(err, alarmNode);
				node.status({ text: err, shape: 'dot', fill: 'red' });
			});

			if (node.alarm) {
				updateStatus('alarm', node.alarm);
				if (node.debug) {
					node.warn('Alarm found in alarm manager: ' + JSON.stringify(node.alarm));
				}
			}
		}

		node.alarmManager.on('alarmPush', (msg) => {
			if (msg.payload.has(node.alarmId)) {
				node.alarm = msg.payload.get(node.alarmId);
				node.alarmSent = true;
				updateStatus('alarm', node.alarm);
			}
		});

		node.on('input', function (msg) {

			node.send(msg);
		});
	}
	RED.nodes.registerType('status-monitor', StatusMonitorNode);
};
