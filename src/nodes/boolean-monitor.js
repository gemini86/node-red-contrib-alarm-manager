module.exports = function (RED) {
    function BooleanMonitorNode(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        this.alarmId = config.alarmId;
        this.highAlarm = config.highAlarm;
        this.lowAlarm = config.lowAlarm;
        this.delayMinutes = config.delayMinutes;
        //retrive the config node
        //node.alarmManager = RED.nodes.getNode(config.alarmManager)
        node.on('input', function (msg) {

            node.send(msg);
        });
    }
    RED.nodes.registerType("boolean monitor", BooleanMonitorNode);
}