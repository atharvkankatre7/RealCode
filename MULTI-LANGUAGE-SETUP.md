# Multi-Language Terminal Support Setup Guide

This guide explains how to enable support for multiple programming languages in the RealCode terminal on Render.

## Current Status

### ✅ **Working Languages (No Setup Required)**
- **JavaScript** - Node.js is pre-installed on Render
- **TypeScript** - Uses ts-node, available with Node.js

### ⚠️ **Languages Requiring Setup**
- Python
- Java  
- C#/.NET
- C++
- Go
- Ruby
- Rust

## Setup Options

### Option 1: Docker Deployment (Recommended)

Use the provided multi-language Dockerfile to deploy with all language runtimes included.

#### Steps:
1. **Update Render Service Settings:**
   - Go to your Render dashboard
   - Find your backend service
   - Go to "Settings" tab
   - Change "Environment" from "Node" to "Docker"
   - Set "Docker Command" to use `server/Dockerfile.multi-lang`

2. **Dockerfile Configuration:**
   The `Dockerfile.multi-lang` includes:
   - Python 3
   - Java OpenJDK 17
   - .NET Core 6.0
   - Go 1.21
   - Rust
   - Ruby
   - GCC/G++ compilers

3. **Deploy:**
   - Push your code changes
   - Render will rebuild using the Docker image
   - All languages will be available

### Option 2: Native Buildpacks (Limited)

Render supports some languages natively but not all at once.

#### Python Support:
- Set environment variable: `RENDER_RUNTIME=python-3.11`
- Add `requirements.txt` if needed

#### Go Support:
- Set environment variable: `RENDER_RUNTIME=go-1.21`
- Add `go.mod` file

**Note:** Native buildpacks only support one primary language at a time.

### Option 3: Manual Installation via Build Commands

Add custom build commands in Render to install additional runtimes:

```bash
# Add to Render "Build Command"
npm install && \
apt-get update && \
apt-get install -y python3 python3-pip openjdk-17-jdk && \
wget -O- https://sh.rustup.rs | sh -s -- -y
```

**Warning:** This approach may be unreliable and slow down builds.

## Language-Specific Configuration

### Python
- **Runtime:** Python 3.11+
- **Command:** `python3` (with `python` fallback)
- **Package Manager:** pip3

### Java
- **Runtime:** OpenJDK 17
- **Compiler:** javac
- **Environment:** JAVA_HOME set automatically

### Go
- **Runtime:** Go 1.21+
- **Build:** Uses `go run` for immediate execution
- **Modules:** Supports Go modules

### Rust
- **Compiler:** rustc via rustup
- **Build:** Compiles to binary then executes
- **Cargo:** Available for project management

### C#/.NET
- **Runtime:** .NET Core 6.0+
- **Build:** Uses `dotnet run`
- **Project:** Creates temporary console project

### C++
- **Compiler:** GCC/G++
- **Build:** Compiles with g++ then executes binary
- **Standards:** C++17 support

### Ruby
- **Runtime:** Ruby 3.0+
- **Gems:** Bundler available

## Testing Language Support

After deployment, test each language with simple programs:

### JavaScript
```javascript
console.log("Hello from JavaScript!");
```

### Python
```python
print("Hello from Python!")
```

### Java
```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
    }
}
```

### Go
```go
package main
import "fmt"
func main() {
    fmt.Println("Hello from Go!")
}
```

## Error Handling

The system now provides helpful error messages when languages aren't available:

- ❌ **Runtime not available:** Shows installation suggestions
- 📚 **Documentation links:** Direct links to official installation guides  
- 🐳 **Docker alternative:** Suggests using Docker deployment

## Recommended Approach

**For Production:** Use Docker deployment (Option 1) as it:
- ✅ Includes all language runtimes
- ✅ Consistent across environments  
- ✅ Faster subsequent deployments
- ✅ Better resource management
- ✅ Easier maintenance

## Deployment Steps (Docker)

1. **Commit the Dockerfile:**
   ```bash
   git add server/Dockerfile.multi-lang
   git commit -m "Add multi-language Docker support"
   git push
   ```

2. **Update Render Settings:**
   - Service Settings → Environment: "Docker"
   - Dockerfile Path: `server/Dockerfile.multi-lang`
   - Build Command: (leave empty, handled by Dockerfile)
   - Start Command: (leave empty, handled by Dockerfile)

3. **Deploy:**
   - Click "Manual Deploy" → "Deploy latest commit"
   - Wait for build (may take 5-10 minutes for first build)
   - Test language support

4. **Verify:**
   - Check terminal connection status
   - Test each language with sample code
   - Monitor Render logs for any issues

## Troubleshooting

### Build Fails
- Check Render build logs
- Verify Dockerfile syntax
- Ensure all package sources are accessible

### Language Not Working
- Check if runtime detection passes
- Verify PATH environment variables
- Test with simple "Hello World" programs

### Performance Issues
- Docker images are larger but more reliable
- Consider using smaller base images if needed
- Monitor memory usage in Render metrics

## Cost Considerations

- Docker deployments may use more resources
- Consider upgrading to paid Render plan for better performance
- Monitor usage and optimize as needed