'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('trade_journal', 'sno');
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('trade_journal', 'sno', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
};
