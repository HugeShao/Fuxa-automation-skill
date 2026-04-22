/**
 * FUXA 脚本模板
 *
 * 完整 API 参考见 SKILL.md "FUXA 脚本 API 参考" 章节
 */

(function() {
    'use strict';

    try {
        // ===== 在此编写脚本逻辑 =====

        // 示例：读取标签值
        // var value = fuxa.getTagValue('t_tag1');

        // 示例：设置标签值
        // fuxa.setTagValue('t_tag2', true);

        // 示例：记录日志
        // fuxa.log('脚本执行', 'info');

        // 示例：条件判断并触发报警
        // if (value > 80) {
        //     fuxa.log('温度过高', 'warn');
        //     fuxa.setAlarm('alarm-001', true);
        // }

        // ===== 脚本逻辑结束 =====

        return {
            success: true,
            message: '脚本执行成功'
        };

    } catch (error) {
        fuxa.log('脚本错误: ' + error.message, 'error');
        return {
            success: false,
            message: '脚本执行失败: ' + error.message
        };
    }
})();