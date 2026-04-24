---
name: writing-unit-tests-csharp
description: Guidelines and patterns for writing unit tests in C# using MSTest SDK.
---
# Skill: Writing C# Unit Tests

## Overview

This skill covers writing unit tests for the backend using **MSTest SDK**. The project uses a lean, zero-config approach that leverages Microsoft's official SDK-style testing.

## Project Structure

```text
backend/
├── WebApp.sln
├── WebApp.Api/
│   ├── Models/           # DTOs and request/response models
│   ├── Services/         # Business logic and agent integration
│   └── Program.cs        # Minimal API endpoints
└── WebApp.Api.Tests/
    ├── WebApp.Api.Tests.csproj
    └── [TestClass].cs    # Test files organized by class under test
```

## Test Project Configuration

The test project uses MSTest SDK which eliminates the need for explicit package references:

See `backend/WebApp.Api.Tests/WebApp.Api.Tests.csproj` for current configuration. The project uses MSTest SDK which eliminates the need for explicit package references — just set `Sdk="MSTest.Sdk/{version}"` in the project element.

## Test Anatomy

```csharp
using WebApp.Api.Models;

namespace WebApp.Api.Tests;

[TestClass]
public class ErrorResponseFactoryTests
{
    [TestMethod]
    public void CreateFromException_ReturnsCorrectStatusCode()
    {
        // Arrange
        var exception = new InvalidOperationException("Test");
        
        // Act
        var result = ErrorResponseFactory.CreateFromException(exception, 500, isDevelopment: false);
        
        // Assert
        Assert.AreEqual(500, result.Status);
    }
    
    [TestMethod]
    [DataRow(400, "Bad Request")]
    [DataRow(401, "Unauthorized")]
    [DataRow(500, "Internal Server Error")]
    public void CreateFromException_MapsStatusToTitle(int status, string expectedTitle)
    {
        // Parameterized test using DataRow
    }
}
```

## Running Tests

```powershell
# Run all backend tests
cd backend
dotnet test

# Run with verbose output
dotnet test --verbosity normal

# Run specific test class
dotnet test --filter "FullyQualifiedName~ErrorResponseFactoryTests"

# Run with coverage (requires coverlet)
dotnet test --collect:"XPlat Code Coverage"
```

## Testable Units in This Project

### Models (Pure, Easy to Test)

| Class | What to Test |
|-------|--------------|
| `ErrorResponseFactory` | Status code mapping, dev vs prod mode, exception detail hiding |
| `ChatRequest` | Validation logic if any |
| `StreamChunk` | Serialization/deserialization |
| `AnnotationInfo` | Property mapping |

### Services (Require Integration Testing)

| Class | Testing Approach |
|-------|------------------|
| `AgentFrameworkService` | Use `validating-ui-features` skill with Playwright for integration tests |

## Test Naming Convention

Use descriptive names following: `MethodName_Scenario_ExpectedBehavior`

```csharp
[TestMethod]
public void CreateFromException_WhenDevelopmentMode_IncludesStackTrace() { }

[TestMethod]
public void CreateFromException_WhenProductionMode_HidesStackTrace() { }
```

## Assertions Reference

MSTest provides these assertion methods:

```csharp
// Equality
Assert.AreEqual(expected, actual);
Assert.AreNotEqual(notExpected, actual);

// Nullability
Assert.IsNull(value);
Assert.IsNotNull(value);

// Boolean
Assert.IsTrue(condition);
Assert.IsFalse(condition);

// Type
Assert.IsInstanceOfType(obj, typeof(ExpectedType));

// Collections
CollectionAssert.Contains(collection, element);
CollectionAssert.AreEqual(expected, actual);

// Exceptions
Assert.ThrowsException<InvalidOperationException>(() => MethodThatThrows());
```

## When Unit Tests Aren't Enough

Use the `validating-ui-features` skill and Playwright when:
- Testing requires a running backend server
- Testing SSE streaming behavior
- Testing authentication flows
- Testing the full chat request/response cycle

## Quick Reference

| Command | Purpose |
|---------|---------|
| `dotnet test` | Run all tests |
| `dotnet test --filter "Name~Test"` | Run filtered tests |
| `dotnet build` | Build without running |
| `dotnet test --list-tests` | List all tests |
