'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('securities', 'paid_up_value', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.changeColumn('securities', 'face_value', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('securities', 'paid_up_value', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
    });
    await queryInterface.changeColumn('securities', 'face_value', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
    });
  },
};
