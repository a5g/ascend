'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'name', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'kite_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'capital', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('users', 'access_token', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  down: async (queryInterface, _Sequelize) => {
    await queryInterface.removeColumn('users', 'access_token');
    await queryInterface.removeColumn('users', 'is_active');
    await queryInterface.removeColumn('users', 'capital');
    await queryInterface.removeColumn('users', 'kite_id');
    await queryInterface.removeColumn('users', 'name');
  },
};
