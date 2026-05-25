'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('securities', 'exchange', {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'NSE',
    });
    await queryInterface.sequelize.query(
      `UPDATE securities SET exchange = 'NSE' WHERE exchange IS NULL OR exchange = ''`
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('securities', 'exchange');
  },
};
