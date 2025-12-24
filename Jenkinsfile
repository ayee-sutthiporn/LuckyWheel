pipeline {
    agent any

    environment {
        // Name of the app/container
        APP_NAME = "lucky-wheel"
        // Port to expose on the server
        HOST_PORT = "8087"
    }

    stages {
        stage('Clone') {
            steps {
                checkout scm
            }
        }

        stage('Build Image') {
            steps {
                script {
                    echo "Building Docker image..."
                    // Build local image tagged with build number
                    if (isUnix()) {
                        sh "docker build -t ${APP_NAME}:${BUILD_NUMBER} ."
                    } else {
                        bat "docker build -t ${APP_NAME}:${BUILD_NUMBER} ."
                    }
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    echo "Deploying container..."
                    // Stop and remove old container
                    if (isUnix()) {
                        sh "docker stop ${APP_NAME} || true"
                        sh "docker rm ${APP_NAME} || true"
                        // Run new container
                        sh "docker run -d -p ${HOST_PORT}:80 --name ${APP_NAME} ${APP_NAME}:${BUILD_NUMBER}"
                    } else {
                        bat "docker stop ${APP_NAME} || exit 0"
                        bat "docker rm ${APP_NAME} || exit 0"
                        // Run new container
                        bat "docker run -d -p ${HOST_PORT}:80 --name ${APP_NAME} ${APP_NAME}:${BUILD_NUMBER}"
                    }
                }
            }
        }
    }

    post {
        success {
            echo "Successfully deployed Lucky Wheel on port ${HOST_PORT}!"
        }
        failure {
            echo "Pipeline failed."
        }
    }
}
