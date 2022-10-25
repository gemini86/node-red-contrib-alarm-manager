module.exports = function (RED) {
	function AlarmManagerNode(config) {
		RED.nodes.createNode(this, config);
		let node = this;
		this.name = config.name;
		node.delayInterval = config.delayMinutes * 60000;
		node.resendInterval = config.resendMinutes * 60000;
		node.debug = config.debug; //when enabled, will send all new alarms to the node.log;

		let nodeContext = node.context();

		node.alarmNodeRegistry = nodeContext.get('monitorNodeRegistry') || new Map();

		node.currentAlarms = nodeContext.get('currentAlarms') || new Map();
		
		let timeout = {
			//parent: this,
			get isRunning () {
				return timeout._pointer ? true : false;
			},
			timeLeft: function () {
				if (timeout.timeStarted) {
					return Date.now() - timeout.timeStarted;
				}
				return;
			}
		};

		let interval = {
			//parent: this, //stores the parent scope to be used in class methods
			get isRunning () {
				if (interval._pointer) {
					if (node.debug) {
						node.warn('Interval running: ' + interval._pointer);
					}
					return true;
				} else {
					if (node.debug) {
						node.warn('No interval running');
					}
					return false;
				}
			}
		};

		function startTimeout(time) {
			timeout.timeStarted = Date.now();
			timeout._pointer = setTimeout(function () {
				sendAlarms(node.currentAlarms);
				stopTimeout();
				//check if there are alarms to send
				checkAlarmsCount();
				//if no interval is running
				if (interval.isRunning == false) {
					//start interval after sending
					if (node.resendInterval) {
						startInterval(node.resendInterval);
					}
				}
			}, time);
			//if there's an interval running, clear it and delete pointer.
			if (interval.isRunning == true) {
				stopInterval();
			}
		}

		function stopTimeout () {
			timeout._pointer = clearTimeout(timeout._pointer);
			delete timeout.timeStarted;
		}

		function startInterval (time) {
			interval.timeStarted = interval.timeAtLastInterval = Date.now();
			if (!interval.isRunning) {
				interval._pointer = setInterval(function () {
					interval.timeAtLastInterval = Date.now();
					sendAlarms(node.currentAlarms);
					checkAlarmsCount();
				}, time);
			}
		}

		function stopInterval () {
			interval._pointer = clearInterval(interval._pointer);
			delete interval.timeStarted;
			delete interval.timeAtLastInterval;
		}

		function sendAlarms(alarms) {
			//TODO set all alarms sent as persistent after sending.
			if (Object.getOwnPropertyNames(alarms).length > 0) {
				let msg = { payload: alarms };
				let toSend = RED.util.cloneMessage(msg);
				node.emit('alarms', toSend);
				//mark all sent alarms as persistent (unless cleared alarms, delete those)
				Object.getOwnPropertyNames(alarms).forEach(item => {
					if (node.currentAlarms[item].type == 'clear') {
						node.currentAlarms.delete(item);
					} else {
						node.currentAlarms[item].persistent.set(true);
					}
				});
				nodeContext.set('currentAlarms', node.currentAlarms);
				
				if (node.debug) {
					node.warn('alarms sent: ' + JSON.stringify(msg));
				}				
			} else {
				node.warn('Warning: alarms not sent because there are none.');
			}
		}

		node.getAlarm = function (alarmId) {
			return node.currentAlarms[alarmId];
		};

		node.setAlarm = function (msg) {
			let alarm = msg.payload;
			//check if an alarm for this id already exists
			if (node.currentAlarms.has(alarm.id)) {
				//update the alarm value
				let thisAlarm = node.currentAlarms.get(alarm.id);
				thisAlarm.value = alarm.value;
				node.currentAlarms.set(alarm.id,thisAlarm);
			} else {
				//set new alarm
				alarm.persistent = false;
				node.currentAlarms.set(alarm.id, alarm);
				if (node.delayInterval) {
					//if no timeout is running, start one
					if (!timeout.isRunning) {
						startTimeout(node.delayInterval);
					}
				} else {
					sendAlarms(node.currentAlarms);
				}
				if (node.debug) {
					node.warn('Alarm set: ' + JSON.stringify(alarm));
					node.warn('Current alarms: ' + JSON.stringify(node.currentAlarms));
				}
			}
			nodeContext.set('currentAlarms', node.currentAlarms);
		};

		node.clearAlarm = function (msg) {
			let alarm = msg.payload;
			//check if alarm already exists
			if (node.currentAlarms.has(alarm.id)) {
				//has it already been sent?
				if (node.currentAlarms.get(alarm.id).persistent) {
					node.currentAlarms.set(alarm.id, alarm); //update alarm (this clear alarm object will have 'clearTimestamp' property with the time of alarm clearing and a 'type' property of "clear")
					if (node.delayInterval) {
						if (!timeout.isRunning) {
							startTimeout(node.delayInterval);
						}
					} else {
						sendAlarms(node.currentAlarms);
					}
				} else {
					//if it's not been sent, delete it right away.
					node.currentAlarms.delete(alarm.id);
					checkAlarmsCount(); //this will check if there are other alarms and cancel any timeouts and/or intervals
				}
				node.warn('Alarm cleared:' + JSON.stringify(alarm));
				nodeContext.set('currentAlarms', node.currentAlarms);
			} else {
				node.error('This alarm does not exist and cannot be cleared: ' + alarm);
			}
		};

		node.registerAlarmNode = function (alarmNode, callback, errCallback) {
			//check if the node is already registered
			if (node.alarmNodeRegistry[alarmNode.id]) {
				if (node.currentAlarms.has(alarmNode.alarmId)) {
					return node.currentAlarms.get(alarmNode.alarmId);
				}
			} else {
				//check if the alarmId is unique
				let nodeFound;
				let registryKeys = [...node.alarmNodeRegistry.keys()];
				for (let thisNode of registryKeys) {
					if (alarmNode.alarmId == thisNode.alarmId) {
						nodeFound = true;
						break;
					}
				}
				if (nodeFound) {
					errCallback(`Error, ${alarmNode.alarmId} is already being used as an alarm ID. All alarm IDs must be unique.`, alarmNode);
				} else {
					node.alarmNodeRegistry.set(alarmNode.id, alarmNode);
					if (node.debug) {
						callback('Alarm node registered: ' + alarmNode.alarmId + ':' + alarmNode.id);
						callback('Alarm nodes registry: ' + JSON.stringify(node.alarmNodeRegistry));
					}
				}
			}
		};

		node.unregisterAlarmNode = function (alarmNode) {
			if (node.alarmNodeRegistry.has(alarmNode.id)) {
				if (node.currentAlarms.has(alarmNode.alarmId)) {
					let msg = {
						payload: node.currentAlarms.get(alarmNode.alarmId)
					};
					node.clearAlarm(msg);
				}
			}
		};

		function checkAlarmsCount() {
			if (node.debug) {
				node.warn('Check alarms count- Current alarms: ' + JSON.stringify(node.currentAlarms));
			}
			if (node.currentAlarms.size > 0) {
				return node.currentAlarms.size;
			} else {
				stopInterval();
				stopTimeout();
				return false;
			}

		}

		if (node.debug) {
			node.warn('Current alarms: ' + JSON.stringify(node.currentAlarms));
		}

		node.on('close', () => {
			node.stopInterval();
			node.startTimeout();
			nodeContext.set('currentAlarms', node.currentAlarms);
		});
	}
	RED.nodes.registerType('alarm-manager', AlarmManagerNode);
};
