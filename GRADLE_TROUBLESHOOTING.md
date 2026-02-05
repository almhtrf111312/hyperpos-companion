# حل مشكلة Gradle for Java Extension في VS Code

## المشكلة
- Update task failed
- Installation failure (v3.17.2)

## الحل الكامل (خطوة بخطوة)

### 1️⃣ إيقاف Gradle Daemon

في Terminal داخل مجلد المشروع:

```bash
# Windows
cd android
.\gradlew.bat --stop

# أو
gradlew --stop
```

ثم أعد تشغيل VS Code.

---

### 2️⃣ مسح الكاش

**في VS Code:**
- اضغط `Ctrl+Shift+P`
- اكتب: `Developer: Reload Window`
- اضغط Enter

**حذف مجلدات الكاش:**
```bash
# احذف .gradle من root المشروع
rm -rf .gradle

# احذف ~/.gradle من home directory
# Windows: C:\Users\YourUsername\.gradle
rm -rf ~/.gradle
```

---

### 3️⃣ إعادة تثبيت Extension

1. افتح Extensions (`Ctrl+Shift+X`)
2. ابحث عن "Gradle for Java"
3. اضغط **Disable**
4. اضغط **Uninstall**
5. أعد تشغيل VS Code
6. افتح Extensions مرة أخرى
7. ابحث عن "Gradle for Java"
8. اضغط **Install**

---

### 4️⃣ إعدادات Gradle

1. اضغط `Ctrl+,` لفتح Settings
2. ابحث عن "Gradle"
3. تأكد من الإعدادات التالية:
   - **Use Gradle from** = `gradle-wrapper.properties`
   - **Show Gradle Tasks** = `true`

---

### 5️⃣ التحقق من JAVA_HOME

في Terminal:

```bash
# التحقق من JAVA_HOME
echo $JAVA_HOME

# التحقق من إصدار Java (يجب JDK 17 أو 21)
java -version
```

**إذا لم يكن JAVA_HOME معرّف:**

Windows:
```bash
# في PowerShell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
```

---

### 6️⃣ إذا فشل كل شيء

حدّث ملف `gradle-wrapper.properties`:

**الملف:** `android/gradle/wrapper/gradle-wrapper.properties`

```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.5-all.zip
```

---

### 7️⃣ بعد الحل

قم بمزامنة Capacitor:

```bash
npx cap sync android
```

---

## ملاحظات إضافية

> [!TIP]
> إذا استمرت المشكلة، جرب:
> - تحديث Gradle Wrapper: `./gradlew wrapper --gradle-version 8.5`
> - حذف مجلد `android/.gradle` و `android/build`
> - إعادة بناء المشروع: `cd android && ./gradlew clean build`

> [!IMPORTANT]
> تأكد من أن لديك JDK 17 أو أحدث مثبت على النظام
