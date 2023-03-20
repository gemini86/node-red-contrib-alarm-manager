module.exports = function (RED) {
	function ConditionMonitorNode(config) {
		RED.nodes.createNode(this, config);
		let node = this;
		node.alarmId = config.alarmId;
		node.highAlarm = Number(config.highAlarm);
		node.lowAlarm = Number(config.lowAlarm);
		node.delayInterval = Number(config.delayMinutes) * 60000;
		node.debug = config.debug;

		//retrive the config node
		node.alarmManager = RED.nodes.getNode(config.alarmManager);

		function createAlarmObject(value, type) {
			let alarm = {
				id: node.alarmId,
				timestamp: Date.now(),
				type: type,
				limit: node[`${type}Alarm`],
				value: value
			};
			return alarm;
		}

		function updateStatus(mode, alarm) {
			if (mode == 'alarm' && alarm) {
				node.status({
					text: `Alarm ${node.alarmSent ? 'condition' : 'pending'}: ${node.alarm.type} - ${node.alarm.value}/${node.alarm.limit}`,
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
				node.alarm = {...msg.payload.get(node.alarmId)};
				node.alarmSent = true;
				updateStatus('alarm', node.alarm);
			} else {
				delete node.alarm;
				node.status({});
			}
		});

		node.on('input', function (msg, send, done) {
			send = send || function () {
				node.send.apply(node, arguments);
			};

			//(msg.enabled = false) will disable the node from setting msg
			if (msg.enabled == false) {
				if (node.alarm) {
					if (node.alarmSent) {
						node.alarm.type = 'clear';
						node.alarm.clearTimestamp = Date.now();
						msg.payload = node.alarm;
						delete node.enabled;
						node.alarmManager.clearAlarm(msg);
					} else {
						clearTimeout(node.alarmTimer);
					}
					delete node.alarm;
				}
				node.enabled = false;
				updateStatus('disabled');
				if (done) {
					done();
				}
				return;
			}

			if (msg.enabled == true) {
				node.enabled = true;
				updateStatus('enabled');
				if (done) {
					done();
				}
				return;
			}

			if (node.enabled == false) {
				if (done) {
					done();
				}
				return;
			}

			if (typeof msg.payload != 'number') {
				node.error('Error: payload must be a number', msg);
				done('Error: payload must be a number');
				return;
			} else {
				if (msg.payload >= this.highAlarm) {
					//store pending alarm
					msg.payload = node.alarm = createAlarmObject(msg.payload, 'high');

					

					if (node.alarmSent) {
						updateStatus('alarm', node.alarm);
						node.alarmManager.setAlarm(msg);
						if (node.debug) {
							node.warn('alarm sent: ' + JSON.stringify(node.alarm));
						}
					} else {
						if (!node.alarmTimer) {
							//start timer to hold pending alarm before sending to the alarm manager.
							node.alarmTimer = setTimeout(() => {
								if (node.debug) {
									node.warn('alarm sent: ' + JSON.stringify(node.alarm));
								}
								node.alarmManager.setAlarm(msg);
								node.alarmSent = true;
								updateStatus('alarm', node.alarm);
								node.alarmTimer = clearTimeout(node.alarmTimer);
							}, node.delayInterval);
						}
						if (node.debug) {
							node.warn('alarm pending: ' + JSON.stringify(node.alarm));
						}
					}
					//update status
					updateStatus('alarm', node.alarm);
				} else if (msg.payload <= this.lowAlarm) {
					//store pending alarm
					msg.payload = node.alarm = createAlarmObject(msg.payload, 'low');

					if (node.debug) {
						node.warn('Alarm pending: ' + JSON.stringify(node.alarm));
					}
					
					if (node.alarmSent) {
						node.alarmManager.setAlarm(msg);
					} else {
						if (!node.alarmTimer) {
							//start timer to hold pending alarm before sending to the alarm manager.
							node.alarmTimer = setTimeout(() => {
								if (node.debug) {
									node.warn('Alarm sent: ' + JSON.stringify(node.alarm));
								}
								node.alarmManager.setAlarm(msg);
								node.alarmSent = true;
								updateStatus('alarm', node.alarm);
								node.alarmTimer = clearTimeout(node.alarmTimer);
							}, node.delayInterval);
						}
					}
					//update status TODO
					updateStatus('alarm', node.alarm);
				} else {
					if (node.alarm) {
						if (node.alarmSent) {
							//clear sent alarm
							/*node.alarm.type = 'clear';
							node.alarm.clearTimestamp = Date.now();
							node.alarm.value = msg.payload;
							msg.payload = node.alarm;
							node.alarmManager.clearAlarm(RED.util.cloneMessage(msg)); */
							
							//copy alarm object to avoid overwriting timestamp
							let clearedAlarm = {
								...node.alarm,
								type: 'clear',
								clearTimestamp: Date.now(),
								value: msg.payload
							};
							msg.payload = clearedAlarm;
							node.alarmManager.clearAlarm(RED.util.cloneMessage(msg));

							node.alarmSent = false;
						} else {
							//cancel pending alarm
							node.alarm.value = msg.payload;
							node.alarmTimer = clearTimeout(node.alarmTimer);
						}
						updateStatus('clear', node.alarm);
						delete node.alarm;
					}
				}
			}
		});

		node.on('close', function (removed, done) {
			if (removed) {
				node.alarmManager.unregisterAlarmNode(node);
				clearTimeout(node.alarmTimer);
			}
			done();
		});

	}
	RED.nodes.registerType('condition-monitor', ConditionMonitorNode);
};
