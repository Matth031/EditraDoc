/**
 * ESLint : refuse les catch vides / « ignore » sans marqueur intentionnel.
 * Autorisé uniquement : commentaire contenant `intentional:` (insensible à la casse).
 *
 * @type {import("eslint").Rule.RuleModule}
 */
export const intentionalCatchRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Exige un commentaire /* intentional: <raison> */ dans tout catch (politique erreurs EditraDoc)."
    },
    schema: [],
    messages: {
      missingIntentional:
        "Catch silencieux interdit. Ajouter /* intentional: <raison> */ ou logger/remonter (voir ERROR-POLICY.md)."
    }
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /**
     * @param {import("estree").BlockStatement} block
     */
    function hasIntentionalComment(block) {
      const comments = sourceCode.getCommentsInside(block);
      return comments.some((c) => /intentional\s*:/i.test(String(c.value || "")));
    }

    /**
     * @param {import("estree").BlockStatement} block
     */
    function isEffectivelyEmpty(block) {
      return !block.body || block.body.length === 0;
    }

    return {
      CatchClause(node) {
        const block = node.body;
        if (!block || block.type !== "BlockStatement") return;
        if (!isEffectivelyEmpty(block)) return;
        if (hasIntentionalComment(block)) return;
        context.report({ node: block, messageId: "missingIntentional" });
      }
    };
  }
};

/** @type {import("eslint").ESLint.Plugin} */
const plugin = {
  meta: { name: "editify", version: "1.0.0" },
  rules: {
    "intentional-catch": intentionalCatchRule
  }
};

export default plugin;
