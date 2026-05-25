'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.renameTable('trade_history', 'trade_journal');
  },
  async down(queryInterface) {
    await queryInterface.renameTable('trade_journal', 'trade_history');
  },
};
