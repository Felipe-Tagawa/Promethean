# 1. Usa o Maven oficial com Java 21 para compilar o projeto
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# 2. Usa o Java 21 leve para rodar o JAR gerado
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*-jar-with-dependencies.jar app.jar

ENV PORT=7070
EXPOSE 7070

CMD ["java", "-jar", "app.jar"]