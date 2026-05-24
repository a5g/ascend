'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('users', 'kite_id', 'zerodha_user_id');
    await queryInterface.removeColumn('users', 'access_token');
    await queryInterface.addColumn('users', 'zerodha_password', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'zerodha_password');
    await queryInterface.addColumn('users', 'access_token', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.renameColumn('users', 'zerodha_user_id', 'kite_id');
  },
};
