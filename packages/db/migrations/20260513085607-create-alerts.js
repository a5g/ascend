'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('alerts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      symbol: {
        type: Sequelize.STRING,
        allowNull: false
      },
      condition: {
        type: Sequelize.STRING,
        allowNull: false
      },
      threshold: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      reference_price: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      channels: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: []
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      triggered_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
    await queryInterface.addIndex('alerts', ['active'], {
      name: 'idx_alerts_active'
    });
    await queryInterface.addIndex('alerts', ['user_id'], {
      name: 'idx_alerts_user_id'
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('alerts');
  }
};
