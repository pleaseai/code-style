# Passion Factory Code Style Rules — Java

Java rules for `@pleaseai/code-style`, condensed from the Google Java Style
Guide. `google-java-format` produces the layout the guide describes. Read it
together with `general.md` in this directory.

## Files and Imports

- A source file holds exactly one top-level class and is named after it
  (`Invoice` in `Invoice.java`). Use UTF-8 and spaces; never tab characters.
- Order file sections as license header, `package`, imports, class, separated
  by one blank line. Do not wrap `package` or `import` lines.
- Do not use wildcard imports, static or not. Group static imports first, then
  non-static, one blank line between, each group in ASCII order.
- Do not statically import nested classes.
- Keep overloads of a method (and constructors) together in one group.
- Put the members of a class in an order you could explain; do not just append
  new methods at the end.

## Formatting

- Indent 2 spaces per block, wrap at 100 columns, one statement per line, one
  variable per declaration.
- Always use braces for `if`, `else`, `for`, `do`, and `while`, even for one
  statement. Use K&R style: no line break before `{`, a break after it, and
  `} else {` on one line.
- When wrapping, break at the highest syntactic level, before operators and the
  `.` of a call chain, after `=`, and indent continuation lines at least 4
  spaces.
- Declare locals close to first use. Write array types as `String[] args`, not
  `String args[]`.
- Keep annotations on class, method, and constructor declarations one per line
  (a single parameterless annotation may share the signature line). Field
  annotations may share a line.
- Write modifiers in JLS order: `public protected private abstract default
  static final sealed non-sealed transient volatile synchronized native
  strictfp`.
- Write long literals with an uppercase `L`.
- Every `switch` is exhaustive, adding an empty `default` if needed. Use
  arrow-form `switch` for switch expressions. Mark intentional fall-through in
  an old-style switch with a `// fall through` comment.
- Add parentheses where precedence could confuse a reader.

## Naming

- Use only ASCII letters and digits in identifiers, with no prefixes or
  suffixes such as `mName`, `name_`, or `kName`.
- Packages and modules are all lowercase with no underscores
  (`com.example.deepspace`). Classes are `UpperCamelCase`; methods, fields,
  parameters, and locals are `lowerCamelCase`.
- Constants (`static final` and deeply immutable) are `UPPER_SNAKE_CASE`. A
  mutable object or a logger is not a constant.
- Type variables are a single capital (optionally with a digit) or a class-style
  name ending in `T` (`RequestT`).
- Treat acronyms as words: `XmlHttpRequest`, `newCustomerId`.
- A test class ends in `Test`; avoid one-letter parameter names in public
  methods.

## Practices

- Always put `@Override` on methods that override or implement.
- Never ignore a caught exception silently. Log it, rethrow it, or explain in a
  comment why doing nothing is right.
- Qualify static members with the class name, not an instance.
- Do not override `Object.finalize`.
- Put exception classes in a dedicated `error` package under the module's
  package (`com/acme/billing/error/InvoiceNotFoundException.java`). The
  `java-error-outside-error-package` ast-grep rule flags exception classes
  elsewhere; files under `error/` and test source sets are exempt.

## Comments and Javadoc

- Write `// TODO: <link to context> - <explanation>`; do not name a person as
  the context.
- Block comments are indented at the surrounding level; do not box them with
  asterisks.
- Give every visible class, member, and record component Javadoc (Markdown
  `///` or traditional `/** */`). It may be omitted for simple obvious members
  such as `getFoo()` and for overrides.
- Start Javadoc with a summary fragment (noun or verb phrase, punctuated like a
  sentence), not "This method returns…". Write `Returns the id.` or
  `{@return the id}`, not `@return the id`.
- Order block tags `@param`, `@return`, `@throws`, `@deprecated`, and never
  leave one with an empty description.

## Testing

- Tests live in `src/test/java`, mirroring the package path of the class under
  test in `src/main/java`, with a `Test` suffix:
  `src/main/java/com/acme/Invoice.java` →
  `src/test/java/com/acme/InvoiceTest.java`.
- Helpers shared by two or more test files go in `src/testFixtures/`.

## Sources

- [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html)

See `NOTICE.md` for licenses.
