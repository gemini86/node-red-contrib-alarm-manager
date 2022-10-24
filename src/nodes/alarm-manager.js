module.exports = function (RED) {
	function AlarmManagerNode(config) {
		RED.nodes.createNode(this, config);
		let node = this;
		let nodeContext = this.context();
		node.delayInterval = config.delayMinutes * 60000;
		node.resendInterval = config.resendMinutes * 60000;
		node.debug = config.debug; //when enabled, will send all new alarms to the node.log;

		class AlarmManager {
			constructor(currentAlarms) {
				this.currentAlarms = currentAlarms;

				this.timeout = {
					parent: this,
					isRunning: function () {
						return this._pointer ? true : false;
					},
					timeLeft: function () {
						if (this.timeStarted) {
							return Date.now() - this.timeStarted;
						}
						return;
					},
					startTimeout: function (timeout) {
						//if there's an interval running, clear it and delete pointer.
						if (parent.interval.isRunning) {
							parent.interval.stopInterval();
						}
						this.timeStarted = Date.now();
						this._pointer = setTimeout(function (parent) {
							parent.sendAlarms(parent.currentAlarms);
							parent.timeout.stopTimeout();
						}, timeout, this.parent);
					},
					stopTimeout: function () {
						clearTimeout(this._pointer);
						delete this._pointer;
						delete this.timeStarted;
					}
				};

				this.interval = {
					parent: this, //stores the parent scope to be used in class methods
					isRunning: function () {
						return this._pointer ? true : false;
					},
					startInterval: function (intervalTime) {
						this.timeStarted = this.timeAtLastInterval = Date.now();
						this._pointer = setInterval(function (parent) {
							parent.interval.timeAtLastInterval = Date.now();
							parent.sendAlarms(parent.currentAlarms);
						}, intervalTime, this.parent);
					},
					stopInterval: function () {
						clearInterval(this._pointer);
						delete this._pointer;
						delete this.timeStarted;
						delete this.timeAtLastInterval;
					}
				};
			}

			sendAlarms(alarms) {
				if (Object.getOwnPropertyNames(alarms).length() > 0) {
					node.emit('alarms', alarms);
					if (node.debug) {
						node.log('alarms sent: ' + alarms);
					}
					//start interval after sending
					if (node.resendInterval) {
						this.interval.startInterval(node.resendInterval);
					}
				} else {
					node.warn('Warning: alarms not send because there are none.');
				}
			}

			getAlarm(id) {
				let result = Object.prototype.hasOwnProperty.call(this.currentAlarms, id);
				if (result) {
					return result.value;
				}
				return result;
			}

			setAlarm(alarm) {
				//check if an alarm for this id already exists
				if (Object.prototype.hasOwnProperty.call(this.currentAlarms, alarm.id)) {
					//update the alarm value
					this.currentAlarms[alarm.id].value = alarm.value;
				} else {
					//set new alarm
					alarm.persistent = false;
					this.currentAlarms[alarm.id] = alarm;
					if (node.delayInterval) {
						this.timeout.startTimeout(node.delayInterval);
					} else {
						this.sendAlarms(this.currentAlarms);
					}
					if (node.debug) {
						node.log(alarm);
					}
				}
			}

			clearAlarm(alarm) {
				//check if alarm already exists
				if (Object.prototype.hasOwnProperty.call(this.currentAlarms, alarm.id)) {
					//has it already been sent?
					if (this.currentAlarms[alarm.id].persistent) {
						this.currentAlarms[alarm.id] = alarm; //update alarm (this clear alarm object will have 'clearTimestamp' property with the time of alarm clearing and a 'type' property of "clear")
						if (node.delayInterval) {
							this.timeout.startTimeout(node.delayInterval);
						} else {
							this.sendAlarms(this.currentAlarms);
						}
					} else {
						//if it's not been sent, delete it right away.
						delete currentAlarms[alarm.id];
						this.checkAlarmsCount(); //this will check if there are other alarms and cancel any timeouts and/or intervals
					}
				} else {
					node.error('This alarm does not exist and cannot be cleared: ' + alarm);
				}
			}

			clearAlarms() {
				this.timeout.stopTimeout();
				this.interval.stopInterval();
				this.currentAlarms = {};
			}

			checkAlarmsCount() {
				let count = Object.getOwnPropertyNames(currentAlarms).length;
				if (count > 0) {
					return count;
				} else {
					this.currentAlarms = {};
					this.interval.stopInterval();
					this.timeout.stopTimeout();
					return false;
				}
			}

			get currentAlarms() {
				return this.currentAlarms;
			}
			
		}

		let currentAlarms = nodeContext.currentAlarms || {};

		node.manager = new AlarmManager(currentAlarms);

	}
	RED.nodes.registerType('alarm manager', AlarmManagerNode);
};
