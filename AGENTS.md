Design a comprehensive technical specification for a stock portfolio management application - Ascend.

The application will be built using the following technology stack:
*   **Frontend:** React
*   **Backend:** Fastify (With Typescript support)
*   **Database:** PostgreSQL with Sequelize ORM
*   **API Integration:** Zerodha APIs for order and dashboard services (Attached the API
*   **Frontend UI:** Included the templates in UI folder

The core modules of the application are:
*   Super-admin
*   Authentication and Authorization
*   User Management
*   Dashboard Display
*   Order Management
*   Position Sizing Management Tool
*   Alerts/Notifications

# Steps

1.  **Architectural Overview**:
    *   Describe the overall architecture for the backend, including service boundaries and communication patterns (e.g., REST, gRPC, message queues).
    *   Describe the architecture for the frontend, including how different frontend applications will be composed and managed.
    *   Detail the technology stack choices and justify their selection.


2.  **Database Design**:
    *   Define the database schema using Sequelize ORM, including tables, relationships, and data types for each module.
    *   Specify indexing strategies for performance optimization.
    *   Describe data partitioning or sharding strategies if anticipated for scalability.

3.  **API Design**:
    *   Define the API specifications for each service, including endpoints, request/response formats (JSON), and authentication mechanisms.
    *   Specify the integration points with Zerodha APIs, including authentication, data retrieval, and order execution.
   *   Required zerodha api’s are listed in the sample folder reference-api..
    *   Detail error handling strategies for API communication.

4.  **Module-Specific Design**: For each core module, provide:
    *   **Super-admin**: Functionality for global application settings, user onboarding, and monitoring. The User can only be added from super admin. There is no register page for the users. 
    *   **Authentication and Authorization**: Authentication flow (e.g., JWT, OAuth), session management, role-based access control (RBAC) implementation.
    *   **User Management**: User profile management, group creation/management, role assignment, permission configuration.
    *   **Dashboard Display**: Data fetching strategy for holdings and trades, filtering and sorting mechanisms, charting library recommendations, real-time updates.
    *   **Order Management**: Order placement (market, limit, stop-loss), modification, cancellation logic, order status tracking, integration with Zerodha order APIs.
    *   **Position Sizing Management Tool**: Algorithms and logic for position sizing (e.g., fixed fractional, fixed risk), user input parameters, output display.
    *   **Alerts/Notifications**: Alert creation interface, notification channels (e.g., in-app, email, SMS), trigger conditions, management of active alerts.

5.  **Cross-Cutting Concerns**:
    *   **Security**: Data encryption (at rest and in transit), input validation, protection against common web vulnerabilities (XSS, CSRF, SQL Injection).
    *   **Scalability**: Strategies for scaling individual microservices and the database.
    *   **Reliability and Fault Tolerance**: Service redundancy, health checks, graceful degradation, disaster recovery.
    *   **Monitoring and Logging**: Centralized logging strategy, performance monitoring tools, alerting for system issues.
    *   **Deployment and CI/CD**: Recommended CI/CD pipeline, containerization strategy (e.g., Docker, Kubernetes).

# Output Format

The output should be a detailed technical specification document. It should be well-structured, using markdown for headings, subheadings, bullet points, and code snippets where necessary. The document should cover all aspects outlined in the "Steps" section with sufficient detail for implementation.

# Notes


*   Clearly articulate the interaction between frontend services and backend services.
*   Consider the asynchronous nature of order execution and how to handle status updates and potential failures.
*   Provide clear justifications for design decisions, especially concerning architectural choices and technology selections.
