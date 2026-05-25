'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('trade_history', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      sno: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      method: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      account: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      instrument: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      qty: {
        type: Sequelize.DECIMAL(18, 4),
        allowNull: false,
      },
      buy_price: {
        type: Sequelize.DECIMAL(18, 4),
        allowNull: false,
      },
      sell_price: {
        type: Sequelize.DECIMAL(18, 4),
        allowNull: true,
      },
      stop_loss: {
        type: Sequelize.DECIMAL(18, 4),
        allowNull: true,
      },
      buy_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      sell_date: {
        type: Sequelize.DATEONLY,
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
    await queryInterface.addIndex('trade_history', ['instrument']);
    await queryInterface.addIndex('trade_history', ['account']);
    await queryInterface.addIndex('trade_history', ['method']);
    await queryInterface.addIndex('trade_history', ['sell_date']);
  },
  down: async (queryInterface, _Sequelize) => {
    await queryInterface.dropTable('trade_history');
  },
};
