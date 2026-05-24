'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('securities', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      symbol: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      name_of_company: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      series: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      date_of_listing: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      paid_up_value: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
      },
      market_lot: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      isin_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      face_value: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  down: async (queryInterface, _Sequelize) => {
    await queryInterface.dropTable('securities');
  },
};
